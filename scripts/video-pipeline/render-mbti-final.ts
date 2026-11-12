// ============================================================
// MBTI-PRO · 一键端到端合成（火山刘语熙配音 + BGM + 底部安全区字幕）
// 输入：<code>_daily_liuyuxi_clean_2k_novoice.mp4 + 火山音频/字幕 + 本地 BGM
// 输出：<code>_daily_final_volc_liuyuxi_bgm.mp4
// 参数对齐 ENTP 已发布基线：1440×2560 / ~12Mbps / -shortest 裁到配音时长
// ============================================================
import { existsSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { muxAudioAndSubtitles } from './compose-video.js'

const ROOT = resolve(import.meta.dirname, '..', '..')
const WORK_DIR = join(ROOT, 'video', 'work')
const OUT_DIR = join(ROOT, 'video', 'output')
const BGM_PATH = join(ROOT, 'video', 'BGM.mp3')

function parseArgs() {
  const args = process.argv.slice(2)
  const opts: { code: string; source?: string } = { code: '' }
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--code' || a === '--type') opts.code = (args[++i] || '').toUpperCase()
    else if (a === '--source') opts.source = args[++i]
  }
  if (!/^[EAI][NBS][TCF][JDP]$/.test(opts.code)) throw new Error('用 --code CODE')
  return opts
}

async function main() {
  const { code, source } = parseArgs()
  const audioDir = join(WORK_DIR, code, 'audio')
  const audioPath = join(audioDir, `${code}_volc_liuyuxi.mp3`)
  const srtPath = join(audioDir, `${code}_volc_liuyuxi.srt`)

  // 默认使用带尾裁剪的 2K 无声源
  const candidates = source
    ? [source]
    : [
        join(OUT_DIR, `${code}_daily_liuyuxi_clean_2k_novoice_auto_tail.mp4`),
        join(OUT_DIR, `${code}_daily_liuyuxi_clean_2k_novoice_tail54.mp4`),
        join(OUT_DIR, `${code}_daily_liuyuxi_clean_2k_novoice.mp4`),
      ]
  const videoPath = candidates.find(p => existsSync(p))
  if (!videoPath) throw new Error(`未找到无声视频，候选:\n  ${candidates.join('\n  ')}`)
  if (!existsSync(audioPath)) throw new Error(`未找到火山配音: ${audioPath}\n请先 tsx render-volc-liuyuxi.ts --code ${code}`)
  if (!existsSync(srtPath)) throw new Error(`未找到字幕: ${srtPath}`)
  if (!existsSync(BGM_PATH)) throw new Error(`未找到 BGM: ${BGM_PATH}`)

  mkdirSync(OUT_DIR, { recursive: true })
  const outputPath = join(OUT_DIR, `${code}_daily_final_volc_liuyuxi_bgm.mp4`)

  console.log(`[final] 视频: ${videoPath}`)
  console.log(`[final] 配音: ${audioPath}`)
  console.log(`[final] 字幕: ${srtPath}`)
  console.log(`[final] BGM : ${BGM_PATH}`)
  console.log(`[final] 输出: ${outputPath}`)

  // 对齐 ENTP 已发布基线：
  //   分辨率 1440×2560（等比与源一致，不做缩放）
  //   码率 12M（ENTP 成片实测 ~1.3Mbps，此上限用于避免过压；-shortest 裁到 51s 配音末）
  //   字幕：MarginV 相对 1440 缩放 → 62 × 1.333 ≈ 82；MarginV 220 × 1.333 ≈ 294
  // 读取火山配音时长，硬裁到配音结束（避免尾部空转）
  const ffmpegInstaller = await import('@ffmpeg-installer/ffmpeg')
  const { spawn } = await import('node:child_process')
  const audioSec: number = await new Promise((res, rej) => {
    const proc = spawn(ffmpegInstaller.default.path, ['-i', audioPath, '-f', 'null', '-'], { stdio: ['ignore', 'ignore', 'pipe'] })
    let s = ''
    proc.stderr?.on('data', (d: Buffer) => { s += d.toString() })
    proc.on('close', () => {
      const m = s.match(/Duration: (\d+):(\d+):([\d\.]+)/)
      if (!m) return rej(new Error('无法获取音频时长'))
      res(parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseFloat(m[3]))
    })
    proc.on('error', rej)
  })
  console.log(`[final] 配音时长: ${audioSec.toFixed(3)}s → 硬裁 -t`)

  await muxAudioAndSubtitles(videoPath, audioPath, srtPath, outputPath, {
    bgmPath: BGM_PATH,
    bgmVolumeDb: -22,      // BGM 相对配音 -22dB，保证人声清晰
    width: 1440,           // 与源等尺寸，避免重缩放损失
    height: 2560,
    subtitleMarginV: 294,  // 底部安全区，抖音底部一栏之上
    subtitleFontSize: 82,  // 单行 16 个汉字
    subtitleOutline: 8,
    subtitleShadow: 2,
    videoCrf: 20,
    maxDurationSec: audioSec,
  })
  console.log(`✅ 完成: ${outputPath}`)
}

main().catch((e) => { console.error(e); process.exit(1) })