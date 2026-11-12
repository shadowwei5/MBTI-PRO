import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import { getStoryTypeScript, type VoiceSegment } from './generate-audio.js'

const FFMPEG_PATH = ffmpegInstaller.path
const ROOT = resolve(import.meta.dirname, '..', '..')
const WORK_DIR = join(ROOT, 'video', 'work')

function loadEnv() {
  const envPath = join(ROOT, '.env.local')
  if (!existsSync(envPath)) throw new Error(`.env.local 不存在: ${envPath}`)
  const kv: Record<string, string> = {}
  for (const line of readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m) kv[m[1]] = m[2].trim()
  }
  return kv
}

function fixPronunciation(text: string): string {
  return text
    .replace(/(\d+)型/g, '$1形')
    .replace(/十六型/g, '十六形')
    .replace(/八十一型/g, '八十一形')
    .replace(/中间型/g, '中间形')
    .replace(/型人格/g, '形人格')
}

async function volcSynth(text: string, cfg: { appid: string; token: string; cluster: string; voice: string }, outPath: string): Promise<void> {
  const body = {
    app: { appid: cfg.appid, token: 'access_token', cluster: cfg.cluster },
    user: { uid: 'mbti-pro' },
    audio: { voice_type: cfg.voice, encoding: 'mp3', speed_ratio: 1.0 },
    request: { reqid: randomUUID(), text: fixPronunciation(text), operation: 'query' },
  }
  const resp = await fetch('https://openspeech.bytedance.com/api/v1/tts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer;${cfg.token}`,
      'Resource-Id': 'volc.megatts.default',
    },
    body: JSON.stringify(body),
  })
  if (!resp.ok) {
    const errText = await resp.text()
    throw new Error(`Volc TTS HTTP ${resp.status}: ${errText.slice(0, 400)}`)
  }
  const json = (await resp.json()) as { code: number; message?: string; data?: string }
  if (json.code !== 3000 || !json.data) {
    throw new Error(`Volc TTS code=${json.code} msg=${json.message}`)
  }
  writeFileSync(outPath, Buffer.from(json.data, 'base64'))
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolveP, rejectP) => {
    const proc = spawn(FFMPEG_PATH, args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    proc.stderr?.on('data', (d) => { stderr += d.toString() })
    proc.on('close', (code) => code === 0 ? resolveP() : rejectP(new Error(`FFmpeg exit ${code}: ${stderr.slice(-400)}`)))
    proc.on('error', rejectP)
  })
}

async function getAudioDurationMs(filePath: string): Promise<number> {
  return new Promise((resolveP, rejectP) => {
    const proc = spawn(FFMPEG_PATH, ['-i', filePath, '-f', 'null', '-'], { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    proc.stderr?.on('data', (d) => { stderr += d.toString() })
    proc.on('close', () => {
      const m = stderr.match(/time=(\d+):(\d+):(\d+\.\d+)/)
      if (!m) return rejectP(new Error(`未取到时长: ${filePath}`))
      resolveP((parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseFloat(m[3])) * 1000)
    })
    proc.on('error', rejectP)
  })
}

async function concatMp3(inputs: string[], outPath: string): Promise<void> {
  const listPath = outPath + '.list.txt'
  writeFileSync(listPath, inputs.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n'))
  await runFfmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', outPath])
  try { unlinkSync(listPath) } catch {}
}

function msToSrt(ms: number): string {
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  const mi = Math.floor(ms % 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(mi).padStart(3, '0')}`
}

function splitSubtitle(text: string): string[] {
  const norm = text.replace(/\s+/g, ' ').trim()
  if (!norm) return []
  if (norm.length <= 18) return [norm]
  const parts = norm.split(/(?<=[，。？！；：])/).filter(Boolean)
  if (parts.length > 1 && parts.every(p => p.length <= 22)) return parts.map(p => p.replace(/[，；：]$/, ''))
  const chunks: string[] = []
  let buf = ''
  for (const ch of norm) {
    buf += ch
    if (buf.length >= 16 && /[，。？！；：、]/.test(ch)) {
      chunks.push(buf.replace(/[，；：]$/, ''))
      buf = ''
    }
  }
  if (buf) chunks.push(buf)
  return chunks
}

function parseArgs() {
  const args = process.argv.slice(2)
  const opts: { code: string; force: boolean } = { code: '', force: false }
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--code' || a === '--type') opts.code = (args[++i] || '').toUpperCase()
    else if (a === '--force') opts.force = true
  }
  if (!/^[EAI][NBS][TCF][JDP]$/.test(opts.code)) throw new Error('用 --code CODE')
  return opts
}

async function main() {
  const { code, force } = parseArgs()
  const env = loadEnv()
  const cfg = {
    appid: env.VOLC_TTS_APPID,
    token: env.VOLC_TTS_ACCESS_TOKEN,
    cluster: env.VOLC_TTS_CLUSTER_MEGA || 'volcano_mega',
    voice: env.VOLC_TTS_SPEAKER_LIUYUXI || 'S_bDk3p0g72',
  }
  if (!cfg.appid || !cfg.token) throw new Error('.env.local missing')

  const dataPath = join(WORK_DIR, code, `${code}.json`)
  if (!existsSync(dataPath)) throw new Error(`缺少数据: ${dataPath}`)
  const data = JSON.parse(readFileSync(dataPath, 'utf-8'))
  const segments: VoiceSegment[] = getStoryTypeScript(data)

  const audioDir = join(WORK_DIR, code, 'audio')
  mkdirSync(audioDir, { recursive: true })
  const outMp3 = join(audioDir, `${code}_volc_liuyuxi.mp3`)
  const outSrt = join(audioDir, `${code}_volc_liuyuxi.srt`)
  if (existsSync(outMp3) && !force) {
    console.log(`已存在: ${outMp3}`)
    return
  }

  console.log(`[volc-tts] ${code} · ${segments.length} 段`)
  const tempFiles: string[] = []
  const srtEntries: { idx: number; start: number; end: number; text: string }[] = []
  let srtIdx = 1
  let cursorMs = 0

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    const speech = (seg.speechText || seg.text).trim()
    const subText = (seg.subtitleText || seg.text).trim()
    console.log(`  [${i + 1}/${segments.length}] ${subText.slice(0, 32)}...`)
    const tempMp3 = join(audioDir, `_volc_tmp_${String(i).padStart(3, '0')}.mp3`)
    let ok = false
    for (let a = 0; a < 3; a++) {
      try { await volcSynth(speech, cfg, tempMp3); ok = true; break }
      catch (e) { console.warn(`    retry ${a + 1}: ${(e as Error).message}`); await new Promise(r => setTimeout(r, 800)) }
    }
    if (!ok) throw new Error(`合成失败: ${speech.slice(0, 30)}`)
    const dur = await getAudioDurationMs(tempMp3)
    const chunks = splitSubtitle(subText)
    const totalWeight = chunks.reduce((s, c) => s + Math.max(1, c.replace(/\s+/g, '').length), 0)
    let chunkStart = cursorMs
    for (let j = 0; j < chunks.length; j++) {
      const isLast = j === chunks.length - 1
      const w = Math.max(1, chunks[j].replace(/\s+/g, '').length)
      const chunkEnd = isLast ? cursorMs + dur : chunkStart + Math.round(dur * (w / totalWeight))
      srtEntries.push({ idx: srtIdx++, start: chunkStart, end: chunkEnd, text: chunks[j] })
      chunkStart = chunkEnd
    }
    cursorMs += dur
    tempFiles.push(tempMp3)
  }

  await concatMp3(tempFiles, outMp3)
  for (const f of tempFiles) { try { unlinkSync(f) } catch {} }

  const srtContent = srtEntries
    .map(e => `${e.idx}\n${msToSrt(e.start)} --> ${msToSrt(e.end)}\n${e.text}\n`)
    .join('\n')
  writeFileSync(outSrt, srtContent, 'utf-8')

  const totalDur = await getAudioDurationMs(outMp3)
  console.log(`✅ MP3: ${outMp3} (${(totalDur / 1000).toFixed(1)}s)`)
  console.log(`✅ SRT: ${outSrt} (${srtEntries.length} 条)`)
}

main().catch(e => { console.error(e); process.exit(1) })
