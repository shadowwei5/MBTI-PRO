import { createWriteStream, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import https from 'node:https'
import googleTTS from 'google-tts-api'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'

const ROOT_DIR = resolve(import.meta.dirname, '..', '..')
const OUT_DIR = join(ROOT_DIR, 'content-marketing', 'review-html', 'voice-audition-extended-2026-07-02')
const BGM_PATH = join(ROOT_DIR, 'video', 'BGM.mp3')
const FFMPEG = ffmpegInstaller.path
const SAMPLE_TEXT = 'ENFP突然安静的时候，往往比他吵吵闹闹更让人心疼。快乐的人也会累，他只是太怕自己的低落，会把别人的兴致也拖下去。'

type Sample = {
  id: string
  provider: 'edge' | 'google'
  title: string
  desc: string
  voice?: string
  lang?: string
  rate?: string
  pitch?: string
  volume?: string
  slow?: boolean
}

const edgeBase = [
  { voice: 'zh-CN-XiaoxiaoNeural', label: '晓晓', desc: '女声，温暖，原默认' },
  { voice: 'zh-CN-XiaoyiNeural', label: '晓伊', desc: '女声，活泼，较年轻' },
  { voice: 'zh-TW-HsiaoYuNeural', label: '台湾晓雨', desc: '女声，台湾腔，较自然' },
  { voice: 'zh-TW-HsiaoChenNeural', label: '台湾晓臻', desc: '女声，台湾腔，稳' },
  { voice: 'zh-HK-HiuMaanNeural', label: '香港 HiuMaan', desc: '女声，港式普通话/粤语感' },
  { voice: 'zh-CN-liaoning-XiaobeiNeural', label: '辽宁晓北', desc: '女声，方言感，去播音腔' },
  { voice: 'zh-CN-shaanxi-XiaoniNeural', label: '陕西晓妮', desc: '女声，明亮，方言感' },
  { voice: 'zh-CN-YunxiNeural', label: '云希', desc: '男声，阳光' },
]
const edgeVariants = [
  { suffix: 'natural', label: '自然', rate: '+20%', pitch: '-2Hz' },
  { suffix: 'douyin', label: '抖音口播', rate: '+32%', pitch: '+2Hz' },
  { suffix: 'soft', label: '温柔慢一点', rate: '+12%', pitch: '-6Hz' },
  { suffix: 'bright', label: '更亮更轻快', rate: '+28%', pitch: '+8Hz' },
]

const samples: Sample[] = []
for (const base of edgeBase) {
  for (const variant of edgeVariants) {
    samples.push({
      id: `edge_${base.voice}_${variant.suffix}`.replace(/[^a-z0-9_-]/gi, '_'),
      provider: 'edge',
      title: `${base.label}｜${variant.label}`,
      desc: `${base.desc}；rate=${variant.rate} pitch=${variant.pitch}`,
      voice: base.voice,
      rate: variant.rate,
      pitch: variant.pitch,
    })
  }
}

samples.push(
  { id: 'google_zh_cn_normal', provider: 'google', title: 'Google 普通话｜正常', desc: 'Google Translate TTS，普通话，轻量在线', lang: 'zh-CN', slow: false },
  { id: 'google_zh_cn_slow', provider: 'google', title: 'Google 普通话｜慢速', desc: 'Google Translate TTS，普通话慢速', lang: 'zh-CN', slow: true },
  { id: 'google_zh_tw_normal', provider: 'google', title: 'Google 台湾中文｜正常', desc: 'Google Translate TTS，台湾中文', lang: 'zh-TW', slow: false },
  { id: 'google_zh_hk_normal', provider: 'google', title: 'Google 香港中文｜正常', desc: 'Google Translate TTS，香港中文', lang: 'zh-HK', slow: false },
)

function run(command: string, args: string[]) {
  return new Promise<void>((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: 'pipe', shell: false })
    let stderr = ''
    child.stderr.on('data', chunk => { stderr += chunk.toString() })
    child.on('exit', code => code === 0 ? resolvePromise() : reject(new Error(`${command} exited ${code}: ${stderr.slice(-500)}`)))
    child.on('error', reject)
  })
}

async function edgeTts(sample: Sample, outPath: string) {
  const candidates = process.platform === 'win32'
    ? [{ command: 'py', prefix: ['-m', 'edge_tts'] }, { command: 'python', prefix: ['-m', 'edge_tts'] }]
    : [{ command: 'python3', prefix: ['-m', 'edge_tts'] }, { command: 'python', prefix: ['-m', 'edge_tts'] }]
  const args = [
    '--voice', sample.voice!,
    '--rate', sample.rate || '+20%',
    '--pitch', sample.pitch || '+0Hz',
    '--text', SAMPLE_TEXT,
    '--write-media', outPath,
  ]
  const errors: string[] = []
  for (const candidate of candidates) {
    try {
      await run(candidate.command, [...candidate.prefix, ...args])
      return
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
    }
  }
  throw new Error(errors.join(' | '))
}

function download(url: string, outPath: string) {
  return new Promise<void>((resolvePromise, reject) => {
    const file = createWriteStream(outPath)
    https.get(url, response => {
      if ((response.statusCode || 0) >= 300 && response.headers.location) {
        file.close()
        return download(response.headers.location, outPath).then(resolvePromise, reject)
      }
      if (response.statusCode !== 200) {
        file.close()
        reject(new Error(`HTTP ${response.statusCode}`))
        return
      }
      response.pipe(file)
      file.on('finish', () => file.close(() => resolvePromise()))
    }).on('error', error => {
      file.close()
      reject(error)
    })
  })
}

async function googleTts(sample: Sample, outPath: string) {
  const urls = googleTTS.getAllAudioUrls(SAMPLE_TEXT, {
    lang: sample.lang || 'zh-CN',
    slow: sample.slow || false,
    host: 'https://translate.google.com',
  })
  if (!urls.length) throw new Error('google-tts-api returned no urls')
  await download(urls[0].url, outPath)
}

async function mixWithBgm(voicePath: string, outPath: string) {
  if (!existsSync(BGM_PATH)) throw new Error(`BGM不存在：${BGM_PATH}`)
  await run(FFMPEG, [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-i', voicePath,
    '-stream_loop', '-1', '-i', BGM_PATH,
    '-filter_complex', '[0:a]volume=1.3,aresample=44100[voice];[1:a]volume=0.13,atrim=0:18,asetpts=N/SR/TB,afade=t=out:st=16:d=2[bgm];[voice][bgm]amix=inputs=2:duration=first,loudnorm=I=-16:TP=-1.5:LRA=11[a]',
    '-map', '[a]', '-c:a', 'libmp3lame', '-b:a', '192k', outPath,
  ])
}

function htmlEscape(value: string) {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char))
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  const cards: string[] = []
  const failures: Array<{ id: string; error: string }> = []
  for (const sample of samples) {
    const raw = join(OUT_DIR, `${sample.id}_raw.mp3`)
    const mixed = join(OUT_DIR, `${sample.id}_bgm.mp3`)
    console.log(`[${sample.provider}] ${sample.title}`)
    try {
      if (!existsSync(raw)) {
        if (sample.provider === 'edge') await edgeTts(sample, raw)
        else await googleTts(sample, raw)
      }
      if (!existsSync(mixed)) await mixWithBgm(raw, mixed)
      cards.push(`<article class="card" data-provider="${sample.provider}">
        <h2>${htmlEscape(sample.title)} <small>${sample.provider}</small></h2>
        <p>${htmlEscape(sample.desc)}</p>
        <div class="audio-row"><span>纯配音</span><audio controls src="${sample.id}_raw.mp3"></audio></div>
        <div class="audio-row"><span>配音+BGM</span><audio controls src="${sample.id}_bgm.mp3"></audio></div>
        <p class="id">${htmlEscape(sample.id)}</p>
      </article>`)
    } catch (error) {
      failures.push({ id: sample.id, error: error instanceof Error ? error.message : String(error) })
      console.warn(`[skip] ${sample.id}: ${failures[failures.length - 1].error}`)
    }
  }

  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<title>MBTI-PRO 扩展音色试听审核</title>
<style>body{margin:0;background:#f7efe2;color:#2e281f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif}.wrap{max-width:1280px;margin:0 auto;padding:34px}h1{font-size:34px;margin:0 0 12px}.lead{font-size:18px;line-height:1.7;color:#635649}.notice{background:#fff4d8;border-left:6px solid #d99b2b;border-radius:18px;padding:16px 20px;margin:18px 0;line-height:1.75}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(500px,1fr));gap:16px}.card{background:#fffaf0;border:1px solid rgba(89,70,45,.16);border-radius:24px;padding:18px;box-shadow:0 14px 40px rgba(102,76,38,.10)}h2{margin:0 0 8px;font-size:22px}small{font-size:13px;color:#937f68}.audio-row{display:grid;grid-template-columns:86px 1fr;align-items:center;gap:12px;margin:10px 0}.audio-row span{font-weight:800;color:#7a5d35}audio{width:100%}.id{font-size:12px;color:#9a8a77;word-break:break-all}.fail{font-size:12px;color:#9a4638;white-space:pre-wrap}</style>
</head><body><main class="wrap"><h1>扩展音色试听审核</h1><p class="lead">本页补充了 Edge 中文音色的语速/音调变体，以及 Google Translate TTS 中文变体。目标不是选“最像机器标准音”，而是选最适合抖音情绪共鸣口播、AI味最低、长期听不累的声音。</p><section class="notice"><b>建议：</b>优先试听“配音+BGM”。如果某个声音在纯配音里一般，但混 BGM 后舒服，也可以作为候选。</section><section class="grid">${cards.join('\n')}</section>${failures.length ? `<h2>生成失败项</h2><pre class="fail">${htmlEscape(JSON.stringify(failures, null, 2))}</pre>` : ''}</main></body></html>`
  writeFileSync(join(OUT_DIR, 'index.html'), html, 'utf8')
  writeFileSync(join(OUT_DIR, 'samples.json'), JSON.stringify({ sampleText: SAMPLE_TEXT, samples, failures }, null, 2), 'utf8')
  console.log(`\n✅ 扩展审核页：${join(OUT_DIR, 'index.html')}`)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
