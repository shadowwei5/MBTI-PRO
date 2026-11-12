// ============================================================
// MBTI-PRO Video Pipeline — 风格样片生成器
// 生成 B/D/E 三种 15 秒左右的视觉方向预览，不依赖 TTS。
// ============================================================

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import { getTypeColor, getNineGroupCode } from './utils/colors.js'

const ROOT_DIR = resolve(import.meta.dirname, '..', '..')
const VIDEO_DIR = join(ROOT_DIR, 'video')
const OUTPUT_DIR = join(VIDEO_DIR, 'output')
const WORK_DIR = join(VIDEO_DIR, 'work', '_style-preview')
const IMAGE_DIR = join(VIDEO_DIR, '81_image')
const FFMPEG_PATH = ffmpegInstaller.path

type PreviewStyle = 'B' | 'D' | 'E'

const STYLE_META: Record<PreviewStyle, { name: string; label: string; title: string; subtitle: string }> = {
  B: {
    name: '情绪短剧片',
    label: 'B · 情绪共鸣故事',
    title: '总是先发现别人快撑不住的人',
    subtitle: '你身边有没有这样一个 ENFJ？',
  },
  D: {
    name: '心理测试报告片',
    label: 'D · 动态测试报告',
    title: '你可能不是普通 ENFJ',
    subtitle: 'MBTI-PRO 把 16 型细分成 81 型',
  },
  E: {
    name: '画像觉醒片',
    label: 'E · 画像觉醒',
    title: 'ENFJ 人格画像正在觉醒',
    subtitle: '如果这张图像你，主页免费测试',
  },
}

const GROUP_NAMES: Record<string, string> = {
  SP: 'SP 暖金组', SD: 'SD 琥珀组', SJ: 'SJ 藏蓝组',
  BT: 'BT 深炭灰组', BC: 'BC 月光银灰组', BF: 'BF 暖燕麦组',
  NT: 'NT 深紫组', NC: 'NC 靛青组', NF: 'NF 翠绿组',
}

interface TypeData {
  code: string
  name: string
  overview: string
  strengths: string[]
  growthAreas: string[]
}

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function parseArgs() {
  const args = process.argv.slice(2)
  const opts = { typeCode: 'ENFJ', duration: 15, style: 'all' as PreviewStyle | 'all' }
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--type') opts.typeCode = args[++i]?.toUpperCase() || opts.typeCode
    else if (args[i] === '--duration') opts.duration = parseInt(args[++i], 10) || opts.duration
    else if (args[i] === '--style') {
      const value = args[++i] || 'all'
      opts.style = value.toLowerCase() === 'all' ? 'all' : value.toUpperCase() as PreviewStyle
    }
  }
  return opts
}

function loadTypeData(code: string): TypeData {
  const localPath = join(VIDEO_DIR, 'work', code, `${code}.json`)
  if (!existsSync(localPath)) {
    throw new Error(`缺少类型数据缓存: ${localPath}。请先运行主脚本生成一次该类型。`)
  }
  return JSON.parse(readFileSync(localPath, 'utf-8'))
}

function getImageUrl(code: string) {
  return `file:///${join(IMAGE_DIR, `${code}.jpg`).replace(/\\/g, '/')}`
}

function short(text: string, max = 34) {
  const normalized = String(text || '').replace(/\s+/g, ' ').replace(/[。；;，,]$/g, '').trim()
  return normalized.length > max ? `${normalized.slice(0, max)}…` : normalized
}

function getPersonaLine(data: TypeData) {
  const sentences = String(data.overview || '')
    .split(/[。！？!?]/)
    .map(s => s.trim())
    .filter(s => s.length >= 14 && s.length <= 42)
  return sentences.find(s => /你有|你是|你擅长|你天然|你的存在/.test(s)) || `${data.name}的珍贵之处，是能在复杂关系里看见人的真实需求`
}

function buildHtml(style: PreviewStyle, data: TypeData, duration: number) {
  const code = data.code
  const colorInfo = getTypeColor(code)
  const groupCode = getNineGroupCode(code)
  const groupName = GROUP_NAMES[groupCode] || groupCode
  const imageUrl = getImageUrl(code)
  const meta = STYLE_META[style]
  const strength1 = short(data.strengths?.[0] || '看见他人的潜力', 26)
  const strength2 = short(data.strengths?.[1] || '把混乱重新组织起来', 26)
  const growth = short(data.growthAreas?.[0] || '也要把自己的需求放在重要位置', 28)
  const personaLine = getPersonaLine(data)
  const css = getStyleCss(style)

  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><style>
*{box-sizing:border-box;margin:0;padding:0} body{background:#050505;overflow:hidden} #stage{width:1080px;height:1920px;position:relative;overflow:hidden;color:#fff;font-family:'Noto Sans SC','Microsoft YaHei',sans-serif;--accent:${colorInfo.hex};--glow:${colorInfo.hex}77;--soft:${colorInfo.hex}2e;background:#090b0a}.grain{position:absolute;inset:0;z-index:50;pointer-events:none;opacity:.24;background:repeating-linear-gradient(0deg,rgba(255,255,255,.035) 0 1px,transparent 1px 4px),radial-gradient(circle at 50% 40%,transparent 40%,rgba(0,0,0,.68) 100%)}
${css}
</style></head><body><div id="stage" data-duration="${duration}">
  <img class="bg" src="${imageUrl}" />
  <div class="backdrop"></div>
  <div class="brand">MBTI-PRO · 81 型人格</div>
  <div class="style-label">${meta.label}</div>
  <div class="code">${code}</div>
  <div class="name">${data.name}</div>
  <div class="group">${groupName}</div>
  <div class="portrait"><img src="${imageUrl}" /></div>
  <div class="headline">${meta.title}</div>
  <div class="subhead">${meta.subtitle}</div>
  <div class="story">${personaLine}。</div>
  <div class="traits"><div><b>优势 01</b><span>${strength1}</span></div><div><b>优势 02</b><span>${strength2}</span></div></div>
  <div class="difference">传统 16 型只给你四个字母，MBTI-PRO 会把中间态也看见。</div>
  <div class="growth">提醒：${growth}。</div>
  <div class="cta"><span>主页网址免费测试</span><small>扫码 / 主页链接 · 无需注册</small><i>81</i></div>
  ${style === 'D' ? reportExtras(code) : ''}
  ${style === 'E' ? awakeningExtras() : ''}
  <div class="grain"></div>
</div></body></html>`
}

function getStyleCss(style: PreviewStyle) {
  if (style === 'B') return `
.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:saturate(1.06) contrast(1.08);opacity:.42;animation:bgDrama 15s ease-in-out forwards}.backdrop{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.38),rgba(0,0,0,.08) 38%,rgba(0,0,0,.86)),radial-gradient(circle at 74% 22%,var(--glow),transparent 30%)}@keyframes bgDrama{from{transform:scale(1.03)}to{transform:scale(1.18) translateX(-30px)}}.brand,.style-label{position:absolute;z-index:5;top:54px;font-weight:800;letter-spacing:.08em}.brand{left:58px;font-size:25px;color:rgba(255,255,255,.72)}.style-label{right:58px;font-size:23px;color:var(--accent);border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:14px 22px;background:rgba(0,0,0,.28)}.portrait{position:absolute;z-index:4;right:58px;top:225px;width:430px;height:600px;border-radius:44px;overflow:hidden;box-shadow:0 50px 140px rgba(0,0,0,.58),0 0 80px var(--glow);animation:portraitIn 1s .3s both, floaty 6s 1.3s ease-in-out infinite}.portrait img{width:100%;height:100%;object-fit:cover;animation:ken 15s ease-in-out forwards}.portrait:after{content:'';position:absolute;inset:0;background:linear-gradient(115deg,transparent 0 40%,rgba(255,255,255,.35) 50%,transparent 60%);animation:sweep 4.8s 2s infinite}.code{position:absolute;left:58px;top:195px;font:900 168px Georgia;color:transparent;-webkit-text-stroke:2px rgba(255,255,255,.76);text-shadow:0 0 55px var(--glow);z-index:5}.name{position:absolute;left:68px;top:345px;font-size:56px;font-weight:900;z-index:5}.group{position:absolute;left:68px;top:428px;font-size:27px;font-weight:800;color:var(--accent);z-index:5}.headline{position:absolute;z-index:6;left:70px;right:70px;top:860px;font-size:76px;line-height:1.16;font-weight:950;letter-spacing:-.04em;text-shadow:0 12px 55px #000;animation:rise .9s .8s both}.subhead{position:absolute;z-index:6;left:72px;right:72px;top:1045px;font-size:38px;line-height:1.35;color:rgba(255,255,255,.8);animation:rise .8s 1.15s both}.story{position:absolute;z-index:6;left:72px;right:72px;top:1180px;font-size:37px;line-height:1.55;color:rgba(255,255,255,.88);animation:rise .8s 1.5s both}.traits{position:absolute;z-index:6;left:72px;right:72px;bottom:325px;display:grid;grid-template-columns:1fr 1fr;gap:18px}.traits div{background:rgba(0,0,0,.38);border:1px solid rgba(255,255,255,.16);border-radius:28px;padding:26px;backdrop-filter:blur(14px);animation:rise .8s 2.2s both}.traits b{display:block;color:var(--accent);font-size:22px;margin-bottom:12px}.traits span{font-size:29px;line-height:1.36}.difference{display:none}.growth{display:none}.cta{position:absolute;z-index:8;left:58px;right:58px;bottom:58px;border-radius:34px;padding:30px 36px;background:#fff;color:#07100b;display:flex;align-items:center;justify-content:space-between;box-shadow:0 0 70px var(--glow);animation:cta 1s 11s both}.cta span{font-size:42px;font-weight:950}.cta small{font-size:22px;font-weight:800;color:#333}.cta i{font-style:normal;font-size:58px;font-weight:950;color:var(--accent)}@keyframes portraitIn{from{opacity:0;transform:translateY(45px) rotate(4deg)}to{opacity:1;transform:translateY(0) rotate(-2deg)}}@keyframes floaty{50%{margin-top:-16px}}@keyframes ken{to{transform:scale(1.13) translateY(-18px)}}@keyframes sweep{0%,45%{transform:translateX(-130%);opacity:0}55%{opacity:.9}72%,100%{transform:translateX(130%);opacity:0}}@keyframes rise{from{opacity:0;transform:translateY(45px);filter:blur(12px)}to{opacity:1;transform:translateY(0);filter:blur(0)}}@keyframes cta{from{opacity:0;transform:translateY(50px)}to{opacity:1;transform:translateY(0)}}`

  if (style === 'D') return `
.bg{position:absolute;right:-40px;top:120px;width:580px;height:820px;object-fit:cover;border-radius:54px;opacity:.34;filter:saturate(.9) contrast(1.1);animation:reportImg 15s ease-in-out forwards}.backdrop{position:absolute;inset:0;background:linear-gradient(135deg,#f5efe4 0%,#ddd1bf 45%,#191c19 45%,#080a08 100%)}.brand{position:absolute;left:60px;top:56px;color:#171717;font-size:26px;font-weight:900;letter-spacing:.08em;z-index:5}.style-label{position:absolute;right:58px;top:54px;z-index:5;font-size:23px;font-weight:900;color:#fff;background:#111;border-radius:999px;padding:14px 22px}.code{position:absolute;left:62px;top:160px;color:#111;font:950 160px Georgia;letter-spacing:.04em;z-index:5}.name{position:absolute;left:72px;top:305px;color:#111;font-size:58px;font-weight:950;z-index:5}.group{position:absolute;left:72px;top:390px;color:var(--accent);font-size:28px;font-weight:900;z-index:5}.portrait{position:absolute;right:68px;top:238px;width:374px;height:510px;border-radius:36px;overflow:hidden;z-index:6;box-shadow:0 40px 100px rgba(0,0,0,.42);animation:stamp .9s .6s both}.portrait img{width:100%;height:100%;object-fit:cover}.headline{position:absolute;left:70px;right:520px;top:520px;color:#111;font-size:66px;line-height:1.12;font-weight:950;z-index:8}.subhead{position:absolute;left:72px;right:535px;top:690px;color:#333;font-size:33px;line-height:1.4;font-weight:800;z-index:8}.story{position:absolute;left:78px;right:78px;top:980px;z-index:8;color:#fff;font-size:38px;line-height:1.55}.traits{position:absolute;left:72px;right:72px;bottom:385px;z-index:9;display:grid;grid-template-columns:1fr 1fr;gap:18px}.traits div{background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.16);border-radius:26px;padding:24px}.traits b{display:block;color:var(--accent);font-size:22px;margin-bottom:10px}.traits span{font-size:28px;line-height:1.35}.difference{position:absolute;left:72px;right:72px;bottom:260px;z-index:9;color:#fff;font-size:34px;line-height:1.35;font-weight:900;background:var(--soft);border-left:8px solid var(--accent);padding:24px 28px;border-radius:20px}.growth{display:none}.cta{position:absolute;left:58px;right:58px;bottom:58px;z-index:12;background:#fff;color:#111;border-radius:32px;padding:28px 34px;display:flex;align-items:center;justify-content:space-between}.cta span{font-size:40px;font-weight:950}.cta small{font-size:22px;font-weight:800;color:#444}.cta i{font-style:normal;font-size:58px;font-weight:950;color:var(--accent)}@keyframes reportImg{from{transform:scale(1.02)}to{transform:scale(1.12) translateY(-22px)}}@keyframes stamp{from{opacity:0;transform:scale(1.25) rotate(8deg);filter:blur(14px)}to{opacity:1;transform:scale(1) rotate(-2deg);filter:blur(0)}}.report-card{position:absolute;left:72px;right:72px;top:820px;height:88px;z-index:9;border:1px solid rgba(255,255,255,.18);border-radius:22px;display:grid;grid-template-columns:repeat(4,1fr);overflow:hidden}.report-card div{display:grid;place-items:center;color:#fff;font-size:42px;font-weight:950;border-right:1px solid rgba(255,255,255,.16)}.report-card small{display:block;font-size:18px;color:rgba(255,255,255,.6);font-weight:700}`

  return `
.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:saturate(1.2) contrast(1.18);opacity:.52;animation:pulseBg 15s ease-in-out forwards}.backdrop{position:absolute;inset:0;background:radial-gradient(circle at 50% 34%,transparent 0 20%,rgba(0,0,0,.22) 42%,rgba(0,0,0,.92) 100%),linear-gradient(180deg,rgba(0,0,0,.24),#020302)}.brand{position:absolute;left:58px;top:54px;z-index:8;font-size:25px;font-weight:900;color:rgba(255,255,255,.75);letter-spacing:.08em}.style-label{position:absolute;right:58px;top:54px;z-index:8;font-size:23px;font-weight:900;color:var(--accent);border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:14px 22px}.portrait{position:absolute;left:50%;top:205px;width:560px;height:760px;margin-left:-280px;border-radius:58px;overflow:hidden;z-index:4;box-shadow:0 0 110px var(--glow),0 50px 160px rgba(0,0,0,.62);animation:awaken 1.2s .25s both, levitate 5.8s 1.5s ease-in-out infinite}.portrait img{width:100%;height:100%;object-fit:cover;animation:deepZoom 15s ease-in-out forwards}.portrait:before{content:'';position:absolute;inset:-20%;z-index:2;background:conic-gradient(from 0deg,transparent,var(--accent),transparent,white,transparent);mix-blend-mode:screen;opacity:.45;animation:rotate 7s linear infinite}.portrait:after{content:'';position:absolute;inset:0;z-index:3;background:repeating-linear-gradient(90deg,transparent 0 18px,rgba(255,255,255,.16) 18px 20px);opacity:.18;animation:scanlines 2.8s linear infinite}.code{position:absolute;left:0;right:0;top:865px;text-align:center;z-index:8;color:#fff;font:950 150px Georgia;text-shadow:0 0 50px var(--glow)}.name{position:absolute;left:0;right:0;top:1010px;text-align:center;z-index:8;font-size:58px;font-weight:950}.group{position:absolute;left:0;right:0;top:1098px;text-align:center;color:var(--accent);font-size:28px;font-weight:900;z-index:8}.headline{position:absolute;left:72px;right:72px;top:1210px;z-index:8;font-size:62px;line-height:1.14;font-weight:950;text-align:center}.subhead{position:absolute;left:72px;right:72px;top:1360px;z-index:8;font-size:34px;line-height:1.4;color:rgba(255,255,255,.82);text-align:center}.story{display:none}.traits{display:none}.difference{position:absolute;left:72px;right:72px;bottom:305px;z-index:8;text-align:center;font-size:34px;line-height:1.38;color:#fff;background:rgba(0,0,0,.38);border:1px solid rgba(255,255,255,.16);border-radius:28px;padding:26px}.growth{display:none}.cta{position:absolute;left:58px;right:58px;bottom:58px;z-index:12;background:#fff;color:#07100b;border-radius:34px;padding:30px 36px;display:flex;align-items:center;justify-content:space-between;box-shadow:0 0 80px var(--glow)}.cta span{font-size:42px;font-weight:950}.cta small{font-size:22px;font-weight:800;color:#333}.cta i{font-style:normal;font-size:58px;font-weight:950;color:var(--accent)}.ring{position:absolute;left:50%;top:505px;width:780px;height:780px;margin-left:-390px;margin-top:-390px;border:2px solid rgba(255,255,255,.16);border-radius:50%;z-index:3;animation:rotate 9s linear infinite}.ring:before,.ring:after{content:'';position:absolute;border-radius:50%;background:var(--accent);box-shadow:0 0 40px var(--accent)}.ring:before{width:18px;height:18px;top:8%;left:50%}.ring:after{width:14px;height:14px;right:10%;bottom:24%}.particles{position:absolute;inset:0;z-index:2;background-image:radial-gradient(circle,var(--accent) 0 2px,transparent 3px);background-size:92px 92px;opacity:.2;animation:particles 12s linear infinite}@keyframes pulseBg{from{transform:scale(1.03)}to{transform:scale(1.2)}}@keyframes awaken{from{opacity:0;transform:scale(.82);filter:blur(24px) brightness(.6)}to{opacity:1;transform:scale(1);filter:blur(0) brightness(1)}}@keyframes levitate{50%{margin-top:-18px}}@keyframes deepZoom{to{transform:scale(1.16)}}@keyframes rotate{to{transform:rotate(360deg)}}@keyframes scanlines{to{transform:translateX(40px)}}@keyframes particles{to{background-position:92px -92px}}`
}

function reportExtras(code: string) {
  return `<div class="report-card"><div>${code[0]}<small>能量</small></div><div>${code[1]}<small>认知</small></div><div>${code[2]}<small>决策</small></div><div>${code[3]}<small>节奏</small></div></div>`
}

function awakeningExtras() {
  return `<div class="particles"></div><div class="ring"></div>`
}

async function renderStyle(style: PreviewStyle, data: TypeData, duration: number) {
  ensureDir(WORK_DIR)
  ensureDir(OUTPUT_DIR)
  for (const file of readdirSync(WORK_DIR).filter(fileName => fileName.endsWith('.webm'))) {
    try { unlinkSync(join(WORK_DIR, file)) } catch {}
  }
  const html = buildHtml(style, data, duration)
  const htmlPath = join(WORK_DIR, `${data.code}_${style}.html`)
  writeFileSync(htmlPath, html, 'utf-8')

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1080, height: 1920 },
    deviceScaleFactor: 1,
    recordVideo: { dir: WORK_DIR, size: { width: 1080, height: 1920 } },
  })
  const page = await context.newPage()
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(duration * 1000)
  await page.close()
  await context.close()
  await browser.close()

  const webm = readdirSync(WORK_DIR).filter(f => f.endsWith('.webm')).sort().pop()
  if (!webm) throw new Error(`录屏失败: ${style}`)
  const source = join(WORK_DIR, webm)
  const output = join(OUTPUT_DIR, `${data.code}_preview_${style}.mp4`)
  await runFfmpeg([
    '-y', '-i', source,
    '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '22', '-pix_fmt', 'yuv420p', '-r', '30',
    '-movflags', '+faststart', output,
  ])
  console.log(`[preview] ${style} ${STYLE_META[style].name}: ${output}`)
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG_PATH, args, { stdio: 'inherit' })
    proc.on('close', code => code === 0 ? resolve() : reject(new Error(`FFmpeg failed: ${code}`)))
    proc.on('error', reject)
  })
}

async function main() {
  const opts = parseArgs()
  const data = loadTypeData(opts.typeCode)
  const styles: PreviewStyle[] = opts.style === 'all' ? ['B', 'D', 'E'] : [opts.style]
  for (const style of styles) await renderStyle(style, data, opts.duration)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
