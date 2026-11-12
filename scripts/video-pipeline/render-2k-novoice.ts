import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import { buildInjectData } from './render-frames.js'

const ROOT = join(import.meta.dirname, '..', '..')
const VIDEO_OUTPUT_DIR = join(ROOT, 'video', 'output')
const VIDEO_WORK_DIR = join(ROOT, 'video', 'work')

// 1440×2560 原生管线（v25）：
//   viewport 1440×2560 + deviceScaleFactor=1 → 内部渲染 1440×2560
//   recordVideo.size 1440×2560 → 无上/下采样，模板已按 1440×2560 布局
//   码率对齐 ENTP 成片（~2 Mbps 源，最终合成 1.3 Mbps）
const CANVAS_W = 1440
const CANVAS_H = 2560
const OUT_W = 1440
const OUT_H = 2560
const FPS = 30
const TAIL_BUFFER_SEC = 1

const FFMPEG_PATH = ffmpegInstaller.path

function parseArgs() {
  const args = process.argv.slice(2)
  const opts: { code: string; seconds?: number } = { code: '' }
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--code' || args[i] === '--type') opts.code = (args[++i] || '').toUpperCase()
    else if (args[i] === '--seconds') opts.seconds = Number(args[++i])
  }
  if (!/^[EAI][NBS][TCF][JDP]$/.test(opts.code)) throw new Error('用 --code CODE')
  return opts
}

async function probeDurationSec(filePath: string): Promise<number> {
  return new Promise((resolveP, rejectP) => {
    const proc = spawn(FFMPEG_PATH, ['-i', filePath, '-f', 'null', '-'], { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    proc.stderr?.on('data', (d) => { stderr += d.toString() })
    proc.on('close', () => {
      const m = stderr.match(/time=(\d+):(\d+):(\d+\.\d+)/)
      if (!m) return rejectP(new Error(`ffprobe 未获取到时长: ${filePath}`))
      resolveP(parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseFloat(m[3]))
    })
    proc.on('error', rejectP)
  })
}

async function main() {
  const { code, seconds } = parseArgs()
  const dataPath = join(VIDEO_WORK_DIR, code, `${code}.json`)
  if (!existsSync(dataPath)) throw new Error(`缺少数据: ${dataPath}`)
  const data = JSON.parse(readFileSync(dataPath, 'utf-8'))

  // 动态录制时长：读取火山配音时长 + 1s 缓冲
  let recordSeconds: number
  if (seconds && Number.isFinite(seconds) && seconds > 0) {
    recordSeconds = Math.ceil(seconds)
  } else {
    const audioPath = join(VIDEO_WORK_DIR, code, 'audio', `${code}_volc_liuyuxi.mp3`)
    if (!existsSync(audioPath)) {
      throw new Error(`缺少火山配音: ${audioPath}\n请先执行: npx tsx render-volc-liuyuxi.ts --code ${code}`)
    }
    const audioSec = await probeDurationSec(audioPath)
    recordSeconds = Math.ceil(audioSec) + TAIL_BUFFER_SEC
    console.log(`[render:2k] 配音时长 ${audioSec.toFixed(3)}s → 录制 ${recordSeconds}s`)
  }

  const outputDir = join(VIDEO_WORK_DIR, code, 'recording')
  mkdirSync(outputDir, { recursive: true })
  const outputPath = join(VIDEO_OUTPUT_DIR, `${code}_daily_liuyuxi_clean_2k_novoice.mp4`)

  console.log(`[render:2k] Chromium viewport ${CANVAS_W}×${CANVAS_H} dsf=1 → recordVideo ${OUT_W}×${OUT_H} @ ${FPS}fps, ${recordSeconds}s`)
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: CANVAS_W, height: CANVAS_H },
    deviceScaleFactor: 1,
    recordVideo: { dir: outputDir, size: { width: OUT_W, height: OUT_H } },
  })
  const page = await context.newPage()

  const templatePath = join(ROOT, 'scripts', 'video-pipeline', 'templates', 'story-video.html')
  let html = readFileSync(templatePath, 'utf-8')
  const injected = buildInjectData(data)
  html = html.replace(/__TYPE_DATA__/g, JSON.stringify(injected).replace(/\\/g, '\\\\').replace(/'/g, "\\'"))
  const tempHtml = join(outputDir, `_render_${code}.html`)
  writeFileSync(tempHtml, html, 'utf-8')

  await page.goto(`file://${tempHtml.replace(/\\/g, '/')}`, { waitUntil: 'networkidle' })
  await page.evaluate((d) => {
    ;(window as any).typeData = d
    const f = (window as any).__refill
    if (typeof f === 'function') f(d)
    ;(window as any).startAnimation?.()
  }, injected as any)

  console.log(`[render:2k] 录制中... ${recordSeconds}s`)
  await page.waitForTimeout(recordSeconds * 1000)

  const videoPath = await page.video()?.path()
  await context.close()
  await browser.close()

  if (!videoPath) throw new Error('未生成视频文件')
  console.log(`[render:2k] WebM 已录制，开始转码（对齐 ENTP 基线码率）...`)

  await new Promise<void>((res, rej) => {
    const proc = spawn(FFMPEG_PATH, [
      '-y', '-i', videoPath,
      '-t', String(recordSeconds),
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
      '-pix_fmt', 'yuv420p', '-r', String(FPS),
      '-movflags', '+faststart',
      outputPath,
    ], { stdio: 'inherit' })
    proc.on('close', (c) => c === 0 ? res() : rej(new Error(`FFmpeg exit ${c}`)))
  })

  console.log(`[render:2k] ✅ 1440×2560 2K 无声视频: ${outputPath}`)
}

main().catch(e => { console.error(e); process.exit(1) })
