// ============================================================
// MBTI-PRO 每日视频音频重混
// 用途：保留已渲染的高清画面，替换为剪映“刘语熙”配音并混入 BGM。
// 默认输入：video/work/{CODE}/audio/{CODE}_jianying_liuyuxi.mp3
// ============================================================

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { muxAudioAndSubtitles } from './compose-video.js'

const ROOT_DIR = resolve(import.meta.dirname, '..', '..')
const OUTPUT_DIR = join(ROOT_DIR, 'video', 'output')
const WORK_DIR = join(ROOT_DIR, 'video', 'work')
const DEFAULT_BGM = join(ROOT_DIR, 'content-marketing', 'assets', 'audio', 'jianying_chill_coffee_gummy_musiclab_confirmed.mp3')
const require = createRequire(import.meta.url)
const FFPROBE = (() => {
  try {
    return require('@ffprobe-installer/ffprobe').path as string
  } catch {
    return 'ffprobe'
  }
})()

interface Options {
  codes: string[]
  bgmPath: string
  suffix: string
  tailSeconds: number
  subtitleFontSize: number
  subtitleMarginV: number
}

function parseArgs(): Options {
  const args = process.argv.slice(2)
  const options: Options = {
    codes: ['ENTP'],
    bgmPath: DEFAULT_BGM,
    suffix: 'final_liuyuxi_bgm',
    tailSeconds: 1.0,
    subtitleFontSize: 72,
    subtitleMarginV: 430,
  }
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (arg === '--codes') options.codes = (args[++i] || '').split(',').map(code => code.trim().toUpperCase()).filter(Boolean)
    else if (arg === '--bgm') options.bgmPath = resolve(args[++i] || DEFAULT_BGM)
    else if (arg === '--suffix') options.suffix = args[++i] || options.suffix
    else if (arg === '--tail-seconds') options.tailSeconds = Number(args[++i] || options.tailSeconds)
    else if (arg === '--subtitle-font-size') options.subtitleFontSize = Number(args[++i] || options.subtitleFontSize)
    else if (arg === '--subtitle-margin-v') options.subtitleMarginV = Number(args[++i] || options.subtitleMarginV)
  }
  return options
}

function pickInputVideo(code: string) {
  const candidates = [
    join(OUTPUT_DIR, `${code}_daily_liuyuxi_clean_2k_novoice_tail54.mp4`),
    join(OUTPUT_DIR, `${code}_daily_liuyuxi_clean_2k_novoice.mp4`),
    join(OUTPUT_DIR, `${code}_daily_liuyuxi_clean_1080p_novoice.mp4`),
    join(OUTPUT_DIR, `${code}_daily_approved_2k_novoice.mp4`),
    join(OUTPUT_DIR, `${code}_daily_approved.mp4`),
    join(OUTPUT_DIR, `${code}_daily_approved_test.mp4`),
    join(OUTPUT_DIR, `${code}_story-video.mp4`),
  ]
  return candidates.find(path => existsSync(path))
}

function pickVoice(code: string) {
  const candidates = [
    join(WORK_DIR, code, 'audio', `${code}_jianying_liuyuxi.mp3`),
    join(WORK_DIR, code, 'audio', `${code}_jianying_liuyuxi.wav`),
    join(WORK_DIR, code, 'audio', `${code}_jianying_liuyuxi.m4a`),
  ]
  return candidates.find(path => existsSync(path))
}

async function run(command: string, args: string[]) {
  return new Promise<void>((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], shell: false })
    let stderr = ''
    child.stderr.on('data', chunk => { stderr += String(chunk) })
    child.on('exit', code => code === 0 ? resolvePromise() : reject(new Error(stderr || `${command} exited with ${code}`)))
    child.on('error', reject)
  })
}

async function probeDuration(path: string) {
  return new Promise<number>((resolvePromise, reject) => {
    const child = spawn(FFPROBE, [
      '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', path,
    ], { stdio: ['ignore', 'pipe', 'pipe'], shell: false })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', chunk => { stdout += chunk })
    child.stderr.on('data', chunk => { stderr += chunk })
    child.on('exit', code => {
      if (code !== 0) reject(new Error(stderr || `ffprobe exited with ${code}`))
      else resolvePromise(Number(stdout.trim()))
    })
  })
}

function msToSrtTime(ms: number): string {
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  const rest = Math.floor(ms % 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(rest).padStart(3, '0')}`
}

function splitSubtitleChunks(text: string): string[] {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim()
  if (!normalized) return []
  const chunks: string[] = []
  let buffer = ''
  for (const char of [...normalized]) {
    buffer += char
    const shouldBreak = /[。！？!?；;]/.test(char) || (/[，,、：:]/.test(char) && buffer.length >= 10) || buffer.length >= 18
    if (shouldBreak) {
      chunks.push(buffer.trim())
      buffer = ''
    }
  }
  if (buffer.trim()) chunks.push(buffer.trim())
  return chunks
}

function wrapSubtitleText(text: string): string {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim()
  if (normalized.length <= 15) return normalized

  const preferred = [...normalized.matchAll(/[，,、：:]/g)]
    .map(match => (match.index ?? 0) + 1)
    .filter(index => index >= 6 && index <= normalized.length - 5)
    .sort((a, b) => Math.abs(a - normalized.length / 2) - Math.abs(b - normalized.length / 2))[0]

  const breakAt = preferred || Math.ceil(normalized.length / 2)
  return `${normalized.slice(0, breakAt)}\n${normalized.slice(breakAt)}`
}

async function buildSubtitleForVoice(code: string, voicePath: string) {
  const scriptPath = join(WORK_DIR, code, 'audio', `${code}_subtitle_script.txt`)
  if (!existsSync(scriptPath)) throw new Error(`缺少字幕稿：${scriptPath}`)
  const lines = readFileSync(scriptPath, 'utf8').split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  const chunks = lines.flatMap(line => splitSubtitleChunks(line))
  const durationMs = Math.max(1000, Math.round((await probeDuration(voicePath)) * 1000))
  const totalWeight = chunks.reduce((sum, chunk) => sum + Math.max(1, chunk.replace(/\s+/g, '').length), 0)
  let current = 0
  const entries = chunks.map((chunk, index) => {
    const isLast = index === chunks.length - 1
    const weight = Math.max(1, chunk.replace(/\s+/g, '').length)
    const chunkMs = isLast ? durationMs - current : Math.max(850, Math.round(durationMs * (weight / totalWeight)))
    const start = current
    const end = isLast ? durationMs : Math.min(durationMs, current + chunkMs)
    current = end
    return `${index + 1}\n${msToSrtTime(start)} --> ${msToSrtTime(end)}\n${wrapSubtitleText(chunk)}\n`
  }).join('\n')
  const outPath = join(WORK_DIR, code, 'audio', `${code}_jianying_liuyuxi.srt`)
  writeFileSync(outPath, entries, 'utf8')
  return outPath
}

async function trimVideoToDuration(inputVideo: string, code: string, targetSeconds: number) {
  const outputVideo = join(OUTPUT_DIR, `${code}_daily_liuyuxi_clean_2k_novoice_auto_tail.mp4`)
  await run(require('@ffmpeg-installer/ffmpeg').path, [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-i', inputVideo,
    '-t', targetSeconds.toFixed(3),
    '-c:v', 'libx264', '-preset', 'slow',
    '-b:v', '35M', '-minrate', '30M', '-maxrate', '45M', '-bufsize', '90M',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    outputVideo,
  ])
  return outputVideo
}

async function remixCode(code: string, options: Options) {
  const baseVideo = pickInputVideo(code)
  const voicePath = pickVoice(code)
  if (!baseVideo) throw new Error(`缺少 ${code} 输入视频`)
  if (!voicePath) throw new Error(`缺少 ${code} 配音文件，请导出到 video/work/${code}/audio/${code}_jianying_liuyuxi.mp3`)
  if (!existsSync(options.bgmPath)) throw new Error(`缺少 BGM：${options.bgmPath}`)

  const voiceDuration = await probeDuration(voicePath)
  const targetDuration = voiceDuration + options.tailSeconds
  const inputVideo = await trimVideoToDuration(baseVideo, code, targetDuration)
  const subtitlePath = await buildSubtitleForVoice(code, voicePath)
  const outPath = join(OUTPUT_DIR, `${code}_daily_${options.suffix}.mp4`)

  console.log(`\n[audio] ${code}`)
  console.log(`  video:    ${inputVideo}`)
  console.log(`  voice:    ${voicePath}`)
  console.log(`  subtitle: ${subtitlePath}`)
  console.log(`  bgm:      ${options.bgmPath}`)
  console.log(`  out:      ${outPath}`)
  console.log(`  duration: voice ${voiceDuration.toFixed(2)}s + tail ${options.tailSeconds.toFixed(2)}s = ${targetDuration.toFixed(2)}s`)

  await muxAudioAndSubtitles(inputVideo, voicePath, subtitlePath, outPath, {
    width: 1440,
    height: 2560,
    videoBitrate: '35M',
    minrate: '30M',
    maxrate: '45M',
    bufsize: '90M',
    bgmPath: options.bgmPath,
    bgmVolumeDb: -16,
    subtitleFontSize: options.subtitleFontSize,
    subtitleMarginV: options.subtitleMarginV,
    subtitleOutline: 8,
    subtitleShadow: 2,
  })
}

async function main() {
  const options = parseArgs()
  mkdirSync(OUTPUT_DIR, { recursive: true })
  for (const code of options.codes) await remixCode(code, options)
  console.log('\n✅ 音频重混完成')
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
