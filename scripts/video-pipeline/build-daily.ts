// ============================================================
// MBTI-PRO · 每日人格视频一键端到端编排器（build-daily）
//
// 目标：对 INTP 已跑通的模板做“单条命令 = 一整套产物”。
// 顺序：
//   1) generate-v3-cover.ts <CODE>              → cover_<CODE>_v4.png（竖版封面 2160×2880）
//   2) render-volc-liuyuxi.ts --code <CODE>     → 火山刘语熙配音 mp3 + srt（已存在则跳过）
//   3) render-2k-novoice.ts   --code <CODE>     → 1440×2560 无声动画（时长自适应配音）
//   4) render-mbti-final.ts   --code <CODE>     → 加 BGM + 底部安全区字幕 → 成片 mp4
//   5) gen-cover-landscape.ts --code <CODE>     → 抖音横版封面 1920×1080
//
// 安全边界：
// - 不触发任何发布动作。
// - 只在需要时调用付费 TTS（若同名 mp3+srt 已存在则跳过，避免 API 浪费）。
// - 单条 / 批量 / 全量三种入口。
// ============================================================
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const ROOT = resolve(import.meta.dirname, '..', '..')
const PIPE = join(ROOT, 'scripts', 'video-pipeline')
const WORK_DIR = join(ROOT, 'video', 'work')
const OUT_DIR = join(ROOT, 'video', 'output')
const LOG_DIR = join(OUT_DIR, '_build_daily')

interface Options {
  codes: string[]
  skipCover: boolean
  skipVoice: boolean
  skipVideo: boolean
  skipFinal: boolean
  skipLandscape: boolean
  forceVoice: boolean
  dryRun: boolean
}

const VALID = /^[EAI][NBS][TCF][JDP]$/

function parseArgs(): Options {
  const args = process.argv.slice(2)
  const opts: Options = {
    codes: [],
    skipCover: false, skipVoice: false, skipVideo: false, skipFinal: false, skipLandscape: false,
    forceVoice: false, dryRun: false,
  }
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--code' || a === '--type') opts.codes.push(String(args[++i]).toUpperCase())
    else if (a === '--codes') opts.codes.push(...String(args[++i]).split(',').map(s => s.trim().toUpperCase()).filter(Boolean))
    else if (a === '--all-16') opts.codes.push(...['ENTP','ENFP','ENTJ','ENFJ','INTP','INTJ','INFP','INFJ','ESTP','ESTJ','ESFP','ESFJ','ISTP','ISTJ','ISFP','ISFJ'])
    else if (a === '--skip-cover') opts.skipCover = true
    else if (a === '--skip-voice') opts.skipVoice = true
    else if (a === '--skip-video') opts.skipVideo = true
    else if (a === '--skip-final') opts.skipFinal = true
    else if (a === '--skip-landscape') opts.skipLandscape = true
    else if (a === '--force-voice') opts.forceVoice = true
    else if (a === '--dry-run') opts.dryRun = true
  }
  opts.codes = [...new Set(opts.codes)]
  const bad = opts.codes.filter(c => !VALID.test(c))
  if (bad.length) throw new Error(`非法人格代码: ${bad.join(', ')}`)
  if (opts.codes.length === 0) throw new Error('必须指定 --code CODE 或 --codes A,B 或 --all-16')
  return opts
}

function runStep(label: string, cmd: string, args: string[], dryRun: boolean): { ok: boolean; ms: number } {
  const t0 = Date.now()
  console.log(`\n▶ [${label}] ${cmd} ${args.join(' ')}`)
  if (dryRun) { console.log('  (dry-run, skipped)'); return { ok: true, ms: 0 } }
  const proc = spawnSync(cmd, args, { cwd: PIPE, stdio: 'inherit', shell: true })
  const ms = Date.now() - t0
  if (proc.status === 0) { console.log(`✓ [${label}] ${(ms / 1000).toFixed(1)}s`); return { ok: true, ms } }
  console.error(`✗ [${label}] exit=${proc.status} (${(ms / 1000).toFixed(1)}s)`)
  return { ok: false, ms }
}

interface Artifact {
  code: string
  coverVertical?: string
  coverLandscape?: string
  voiceMp3?: string
  voiceSrt?: string
  video2kNovoice?: string
  finalMp4?: string
  errors: string[]
  ok: boolean
  elapsedMs: number
}

function processOne(code: string, opts: Options): Artifact {
  console.log(`\n===================== ${code} =====================`)
  const t0 = Date.now()
  const art: Artifact = { code, errors: [], ok: true, elapsedMs: 0 }
  const audioDir = join(WORK_DIR, code, 'audio')
  const audioMp3 = join(audioDir, `${code}_volc_liuyuxi.mp3`)
  const audioSrt = join(audioDir, `${code}_volc_liuyuxi.srt`)
  const dataJson = join(WORK_DIR, code, `${code}.json`)

  if (!existsSync(dataJson)) {
    art.errors.push(`缺少人格数据: ${dataJson}`)
    art.ok = false
    art.elapsedMs = Date.now() - t0
    return art
  }

  // 1) 竖版封面 v4
  if (!opts.skipCover) {
    const r = runStep('cover-vertical', 'npx', ['tsx', 'generate-v3-cover.ts', code], opts.dryRun)
    if (!r.ok) { art.errors.push('cover-vertical 失败'); art.ok = false }
    else art.coverVertical = join(OUT_DIR, `cover_${code}_v4.png`)
  }

  // 2) 火山刘语熙配音（有则跳过；--force-voice 强制重跑）
  if (!opts.skipVoice) {
    const both = existsSync(audioMp3) && existsSync(audioSrt)
    if (both && !opts.forceVoice) {
      console.log(`↷ [voice-liuyuxi] 跳过：已存在 ${audioMp3}`)
      art.voiceMp3 = audioMp3
      art.voiceSrt = audioSrt
    } else {
      const r = runStep('voice-liuyuxi', 'npx', ['tsx', 'render-volc-liuyuxi.ts', '--code', code], opts.dryRun)
      if (!r.ok) { art.errors.push('voice-liuyuxi 失败'); art.ok = false }
      else { art.voiceMp3 = audioMp3; art.voiceSrt = audioSrt }
    }
  }

  // 3) 无声 2K 视频（时长按配音）
  if (!opts.skipVideo && art.ok) {
    const r = runStep('video-2k-novoice', 'npx', ['tsx', 'render-2k-novoice.ts', '--code', code], opts.dryRun)
    if (!r.ok) { art.errors.push('render-2k-novoice 失败'); art.ok = false }
    else art.video2kNovoice = join(OUT_DIR, `${code}_daily_liuyuxi_clean_2k_novoice.mp4`)
  }

  // 4) 最终合成（配音 + BGM + 底部安全区字幕）
  if (!opts.skipFinal && art.ok) {
    const r = runStep('video-final', 'npx', ['tsx', 'render-mbti-final.ts', '--code', code], opts.dryRun)
    if (!r.ok) { art.errors.push('render-mbti-final 失败'); art.ok = false }
    else art.finalMp4 = join(OUT_DIR, `${code}_daily_final_volc_liuyuxi_bgm.mp4`)
  }

  // 5) 横版封面（依赖竖版）
  if (!opts.skipLandscape && art.ok) {
    const r = runStep('cover-landscape', 'npx', ['tsx', 'gen-cover-landscape.ts', '--code', code], opts.dryRun)
    if (!r.ok) { art.errors.push('gen-cover-landscape 失败'); art.ok = false }
    else art.coverLandscape = join(OUT_DIR, `cover_${code}_daily_landscape.png`)
  }

  art.elapsedMs = Date.now() - t0
  return art
}

async function main() {
  const opts = parseArgs()
  mkdirSync(LOG_DIR, { recursive: true })
  const t0 = Date.now()
  const results: Artifact[] = []

  console.log(`build-daily · 待处理 ${opts.codes.length} 个人格: ${opts.codes.join(', ')}`)
  for (const code of opts.codes) results.push(processOne(code, opts))

  const ok = results.filter(r => r.ok).length
  const fail = results.length - ok
  const elapsedMin = ((Date.now() - t0) / 1000 / 60).toFixed(1)

  console.log('\n=========== SUMMARY ===========')
  for (const r of results) {
    console.log(`${r.ok ? '✓' : '✗'} ${r.code}  ${(r.elapsedMs / 1000).toFixed(1)}s  ${r.errors.join('; ')}`)
    if (r.finalMp4) console.log(`   video : ${r.finalMp4}`)
    if (r.coverVertical) console.log(`   cover : ${r.coverVertical}`)
    if (r.coverLandscape) console.log(`   cover▬: ${r.coverLandscape}`)
  }
  console.log(`共 ${results.length} 个，成功 ${ok}，失败 ${fail}，用时 ${elapsedMin} 分钟`)

  const logPath = join(LOG_DIR, `${new Date().toISOString().replace(/[:.]/g, '-')}_build-daily.json`)
  writeFileSync(logPath, JSON.stringify({ startedAt: new Date(t0).toISOString(), codes: opts.codes, results }, null, 2), 'utf-8')
  console.log(`日志: ${logPath}`)

  process.exit(fail === 0 ? 0 : 1)
}

main().catch(e => { console.error(e); process.exit(1) })
