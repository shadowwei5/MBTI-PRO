// ============================================================
// MBTI-PRO Video Pipeline — 正式审核样片生成器
// 生成：置顶推广视频 + ENFJ 每日人格视频（封面/配音/字幕/结尾 CTA）
// 不调用付费 AI，仅使用本地图片、Playwright、edge-tts、FFmpeg。
// ============================================================

import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import { spawn } from 'node:child_process'
import { generateVoiceover, type VoiceSegment } from './generate-audio.js'
import { convertWebmToMp4, muxAudioAndSubtitles } from './compose-video.js'

const requireFromHere = createRequire(import.meta.url)

const ROOT_DIR = resolve(import.meta.dirname, '..', '..')
const VIDEO_DIR = join(ROOT_DIR, 'video')
const OUTPUT_DIR = join(VIDEO_DIR, 'output')
const WORK_DIR = join(VIDEO_DIR, 'work', '_formal-samples')
const IMAGE_DIR = join(VIDEO_DIR, '81_image')
const FFMPEG_PATH = ffmpegInstaller.path
const SITE_URL = 'https://mbti-pro.com/'

type SampleKind = 'pinned' | 'daily' | 'all'

interface TypeData {
  code: string
  name: string
  overview: string
  strengths: string[]
  growthAreas: string[]
  population?: string | null
  _colorHex?: string
  _colorTextHex?: string
  _groupCode?: string
}

interface RenderSpec {
  kind: Exclude<SampleKind, 'all'>
  slug: string
  durationSeconds: number
  title: string
  coverTitle: string
  coverSubtitle: string
  voiceSegments: VoiceSegment[]
  html: string
}

function ensureDir(dirPath: string) {
  if (!existsSync(dirPath)) mkdirSync(dirPath, { recursive: true })
}

function parseArgs() {
  const args = process.argv.slice(2)
  const options = { kind: 'all' as SampleKind, typeCode: 'ENFJ' }

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--kind') options.kind = (args[index + 1] || 'all') as SampleKind
    if (args[index] === '--type') options.typeCode = (args[index + 1] || 'ENFJ').toUpperCase()
  }

  return options
}

function loadTypeData(code: string): TypeData {
  const dataPath = join(VIDEO_DIR, 'work', code, `${code}.json`)
  if (!existsSync(dataPath)) {
    throw new Error(`缺少 ${code} 数据缓存：${dataPath}。请先运行 npx tsx index.ts --type ${code} --dry-run 之外的生成流程。`)
  }
  return JSON.parse(readFileSync(dataPath, 'utf-8'))
}

function imageUrl(code: string) {
  return `file:///${join(IMAGE_DIR, `${code}.jpg`).replace(/\\/g, '/')}`
}

function safeJson(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

function cleanText(text: string) {
  return String(text || '').replace(/\s+/g, ' ').trim()
}

function shorten(text: string, maxLength: number) {
  const normalized = cleanText(text).replace(/[。；;，,]$/g, '')
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}…` : normalized
}

function splitReadableLines(text: string, maxLength = 16) {
  const normalized = cleanText(text)
  const lines: string[] = []
  let cursor = 0
  while (cursor < normalized.length) {
    lines.push(normalized.slice(cursor, cursor + maxLength))
    cursor += maxLength
  }
  return lines.slice(0, 3)
}

async function generateQrDataUrl() {
  const qrcodeModule = requireFromHere(join(ROOT_DIR, 'client', 'node_modules', 'qrcode')) as {
    toDataURL: (text: string, options: Record<string, unknown>) => Promise<string>
  }

  return qrcodeModule.toDataURL(SITE_URL, {
    width: 360,
    margin: 1,
    color: { dark: '#07120B', light: '#FFFFFF' },
    errorCorrectionLevel: 'M',
  })
}

function getSharedCss() {
  return `
*{box-sizing:border-box;margin:0;padding:0}body{background:#020403;overflow:hidden}#stage{width:1080px;height:1920px;position:relative;overflow:hidden;color:#fff;font-family:'Microsoft YaHei','PingFang SC',Arial,sans-serif;background:#020403}.noise{position:absolute;inset:0;z-index:2;opacity:.11;mix-blend-mode:screen;background-image:radial-gradient(circle at 22% 18%,rgba(255,255,255,.32) 0 1px,transparent 1.8px),radial-gradient(circle at 70% 52%,rgba(255,255,255,.18) 0 1px,transparent 2px);background-size:64px 64px,96px 96px}.grain{position:absolute;inset:-20%;z-index:18;pointer-events:none;opacity:.045;background:repeating-linear-gradient(0deg,rgba(255,255,255,.35) 0 1px,transparent 1px 4px)}.brand{position:absolute;left:58px;top:52px;z-index:30;display:flex;align-items:center;gap:16px;font-size:25px;font-weight:900;letter-spacing:.04em;color:rgba(255,255,255,.9)}.brand-mark{width:48px;height:48px;border-radius:16px;display:grid;place-items:center;background:linear-gradient(135deg,#7BFFB0,#22A667);color:#051008;font-weight:1000;box-shadow:0 0 38px rgba(83,255,154,.42)}.page-tag{position:absolute;right:58px;top:56px;z-index:30;padding:14px 20px;border:1px solid rgba(255,255,255,.18);border-radius:999px;background:rgba(255,255,255,.08);font-size:22px;font-weight:800;color:rgba(255,255,255,.78)}.cover-title{position:absolute;left:64px;right:64px;top:140px;z-index:25;font-size:82px;line-height:1.04;font-weight:1000;letter-spacing:-.05em;text-shadow:0 12px 60px rgba(0,0,0,.65)}.cover-title em{font-style:normal;color:#8DFFB6;text-shadow:0 0 44px rgba(83,255,154,.72)}.cover-subtitle{position:absolute;left:70px;right:70px;top:345px;z-index:25;font-size:30px;line-height:1.35;font-weight:800;color:rgba(255,255,255,.82)}.strong-line{display:inline-block;margin-top:22px;padding:16px 20px;border-radius:20px;background:rgba(141,255,182,.13);border:1px solid rgba(141,255,182,.32);color:#baffd1}.persona-img{position:absolute;z-index:5;object-fit:cover;box-shadow:0 30px 100px rgba(0,0,0,.5)}.glass{background:rgba(6,18,11,.78);border:1px solid rgba(255,255,255,.15);box-shadow:0 22px 64px rgba(0,0,0,.42),inset 0 1px 0 rgba(255,255,255,.12)}.scene-title{font-size:58px;line-height:1.13;font-weight:1000;letter-spacing:-.04em}.scene-copy{font-size:34px;line-height:1.42;font-weight:700;color:rgba(255,255,255,.82)}.pill{display:inline-flex;align-items:center;gap:10px;padding:12px 18px;border-radius:999px;background:rgba(141,255,182,.14);border:1px solid rgba(141,255,182,.34);color:#bbffd3;font-size:24px;font-weight:900}.metric{font-size:120px;font-weight:1000;letter-spacing:-.08em;color:#8DFFB6;text-shadow:0 0 60px rgba(83,255,154,.62)}.fixed-sub-safe{position:absolute;left:0;right:0;bottom:0;height:126px;z-index:3;background:linear-gradient(0deg,rgba(0,0,0,.48),rgba(0,0,0,0))}.ending{position:absolute;inset:0;z-index:28;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;background:radial-gradient(circle at 50% 35%,rgba(83,255,154,.28),transparent 38%),linear-gradient(180deg,rgba(3,18,10,.94),#020403);opacity:0;animation:endReveal var(--duration) linear forwards}.ending h2{font-size:78px;line-height:1.1;font-weight:1000;letter-spacing:-.04em}.ending p{margin-top:24px;font-size:36px;line-height:1.35;color:rgba(255,255,255,.82);font-weight:800}.qr-card{margin-top:42px;padding:24px;border-radius:36px;background:#fff;color:#07120B;box-shadow:0 0 80px rgba(83,255,154,.45)}.qr-card img{width:260px;height:260px;display:block}.qr-card strong{display:block;margin-top:18px;font-size:32px}.site-url{margin-top:24px;padding:18px 28px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);font-size:28px;font-weight:900;color:#baffd1}@keyframes noiseMove{to{background-position:54px -54px,-82px 82px}}@keyframes grain{50%{transform:translate(2%,1%)}}@keyframes floatSoft{50%{transform:translateY(-10px) scale(1.012)}}@keyframes slowZoom{to{transform:scale(1)}}@keyframes avatarDrift{0%{transform:rotate(-7deg) scale(1.06)}100%{transform:rotate(-5deg) scale(1.09)}}@keyframes dailyPortraitMotion{0%,8%{transform:translate3d(0,220px,0) scale(.96)}14%,42%{transform:translate3d(0,0,0) scale(1)}70%{transform:translate3d(0,-8px,0) scale(1.01)}100%{transform:translate3d(0,0,0) scale(1)}}@keyframes ambientPulse{50%{opacity:.24}}@keyframes endReveal{0%,88%{opacity:0;pointer-events:none}94%,100%{opacity:1;pointer-events:auto}}@keyframes endingIn{0%{opacity:0;transform:translateY(24px) scale(.985);pointer-events:none}100%{opacity:1;transform:translateY(0) scale(1);pointer-events:auto}}@keyframes coverOut{0%,6%{opacity:1;transform:scale(1)}10%,100%{opacity:0;transform:scale(1.04);pointer-events:none}}@keyframes coverOutShort{0%,82%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1.035);pointer-events:none}}@keyframes sceneInOut{0%{opacity:0;transform:translateY(8px)}12%,82%{opacity:1;transform:translateY(0)}100%{opacity:0;transform:translateY(-6px)}}@keyframes pulseGlow{50%{filter:drop-shadow(0 0 44px rgba(141,255,182,.8))}}
`
}


function getPinnedLayoutFixCss() {
  return `
.noise{animation:noiseMove 18s linear infinite;will-change:background-position}
.cover{z-index:48}.brand{z-index:60}.page-tag{display:none!important}.cover .halo{animation:haloBreathe 5.5s ease-in-out infinite}.cover-formula{top:560px}.avatar-grid{top:740px;height:900px;opacity:.93;animation:avatarOrbit 18s ease-in-out infinite;will-change:transform}.avatar-grid:after{content:'';position:absolute;inset:-120px;background:radial-gradient(circle at 50% 50%,transparent 43%,rgba(2,4,3,.50) 76%);pointer-events:none}.avatar-grid img{width:248px;height:248px;animation:avatarCardFloat 5.8s ease-in-out infinite;will-change:transform}.dashboard{top:165px;z-index:30}.dashboard .panel{padding:34px;background:linear-gradient(180deg,rgba(6,18,11,.86),rgba(6,18,11,.66))}.middle-values{top:280px;z-index:31}.middle-values div{background:rgba(6,18,11,.74);box-shadow:0 18px 48px rgba(0,0,0,.28)}.report-scene{top:210px;z-index:32}.report-scene>.glass{padding:34px!important;background:linear-gradient(180deg,rgba(6,18,11,.84),rgba(6,18,11,.66))}.fixed-sub-safe{z-index:35}.ending{z-index:70}
@keyframes avatarOrbit{0%{transform:rotate(-6deg) translate3d(-28px,0,0) scale(1.03)}50%{transform:rotate(-3deg) translate3d(34px,-28px,0) scale(1.055)}100%{transform:rotate(-6deg) translate3d(-24px,0,0) scale(1.04)}}
@keyframes avatarCardFloat{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(0,-24px,0)}}
@keyframes sceneInOut{0%{opacity:0;transform:translate3d(0,42px,0) scale(.982)}12%,80%{opacity:1;transform:translate3d(0,0,0) scale(1)}100%{opacity:0;transform:translate3d(0,-28px,0) scale(.99)}}
@keyframes haloBreathe{50%{opacity:.75;transform:scale(1.06)}}
`
}

function normalizeHex(value: string | undefined, fallback: string) {
  if (!value) return fallback
  const normalized = value.trim()
  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized : fallback
}

function hexToRgb(hex: string) {
  const value = normalizeHex(hex, '#E8816B').slice(1)
  return `${parseInt(value.slice(0, 2), 16)},${parseInt(value.slice(2, 4), 16)},${parseInt(value.slice(4, 6), 16)}`
}

function getBrandVideoCss(accentHex = '#E8816B') {
  const accent = normalizeHex(accentHex, '#E8816B')
  const accentRgb = hexToRgb(accent)

  return `
:root{--brand-cream:#FDF8F0;--brand-surface:#EDE6D8;--brand-warm:#F3E7D2;--brand-charcoal:#2D2A26;--brand-coral:#E8816B;--brand-gold:#D4A853;--brand-sage:#8BA888;--type-accent:${accent};--type-accent-rgb:${accentRgb}}
#stage{background:radial-gradient(circle at 26% 14%,rgba(232,129,107,.22),transparent 34%),radial-gradient(circle at 82% 68%,rgba(212,168,83,.18),transparent 38%),linear-gradient(180deg,#FDF8F0 0%,#F3E7D2 58%,#EDE6D8 100%)!important;color:var(--brand-charcoal)!important}.noise{opacity:.08!important;mix-blend-mode:multiply!important}.grain{opacity:.025!important;mix-blend-mode:multiply!important}.brand{color:var(--brand-charcoal)!important;text-shadow:none!important}.brand-mark{background:linear-gradient(135deg,var(--brand-coral),var(--brand-gold))!important;color:var(--brand-charcoal)!important;box-shadow:0 12px 34px rgba(232,129,107,.24)!important}.page-tag{background:rgba(255,255,255,.58)!important;color:rgba(45,42,38,.76)!important;border-color:rgba(45,42,38,.12)!important}.cover-title,.scene-title,.type-name,.ending h2{color:var(--brand-charcoal)!important;text-shadow:0 8px 28px rgba(255,255,255,.45)!important}.cover-subtitle,.scene-copy,.ending p,.report-row small{color:rgba(45,42,38,.76)!important}.cover-title em,.metric,.code,.trait small,.difference strong,.bottom-badge,.daily-code-badge{color:var(--type-accent)!important;text-shadow:none!important}.strong-line,.pill{background:rgba(255,255,255,.58)!important;border-color:rgba(232,129,107,.30)!important;color:var(--brand-charcoal)!important}.glass{background:linear-gradient(180deg,rgba(255,255,255,.74),rgba(253,248,240,.60))!important;border-color:rgba(45,42,38,.12)!important;color:var(--brand-charcoal)!important;box-shadow:0 22px 64px rgba(90,72,48,.16),inset 0 1px 0 rgba(255,255,255,.70)!important}.formula-card small,.equation-block small,.middle-values small{color:rgba(45,42,38,.58)!important}.equation-block,.report-row div,.middle-values div{background:rgba(255,255,255,.56)!important;border-color:rgba(45,42,38,.10)!important;color:var(--brand-charcoal)!important}.chat{background:rgba(255,255,255,.66)!important;color:var(--brand-charcoal)!important;border-color:rgba(45,42,38,.10)!important}.qr-card,.qr-mini{color:var(--brand-charcoal)!important}.qr-card{box-shadow:0 22px 78px rgba(232,129,107,.22)!important}.site-url{color:var(--brand-charcoal)!important;border-color:rgba(232,129,107,.28)!important;background:rgba(255,255,255,.55)!important}.ending{background:radial-gradient(circle at 50% 34%,rgba(232,129,107,.22),transparent 38%),linear-gradient(180deg,rgba(253,248,240,.96),#EDE6D8)!important}.fixed-sub-safe{background:linear-gradient(0deg,rgba(253,248,240,.84),rgba(253,248,240,0))!important}
`
}

function getDailyBrandCss(typeData: TypeData) {
  return `${getBrandVideoCss(typeData._colorHex || '#2D8A4E')}
.main-portrait{box-shadow:0 34px 110px rgba(90,72,48,.25),0 0 0 10px rgba(255,255,255,.54),0 0 74px rgba(var(--type-accent-rgb),.20)!important}.scan-ring{border-color:rgba(var(--type-accent-rgb),.24)!important;box-shadow:0 0 42px rgba(var(--type-accent-rgb),.14)!important}.chat:nth-child(2){background:rgba(var(--type-accent-rgb),.12)!important;border-color:rgba(var(--type-accent-rgb),.28)!important}.bg-portrait{filter:blur(18px) brightness(1.04) saturate(.86) opacity(.22)!important}.daily-code-badge{position:absolute;right:64px;top:184px;z-index:52;font-size:92px;line-height:.92;font-weight:1000;letter-spacing:-.08em;color:var(--type-accent);padding:14px 22px 20px;border-radius:32px;background:rgba(255,255,255,.66);border:1px solid rgba(45,42,38,.10);box-shadow:0 22px 64px rgba(90,72,48,.16)}
`
}

function getDailyLayoutFixCss() {
  return `
.noise{animation:noiseMove 18s linear infinite;will-change:background-position}.brand{z-index:60}.page-tag{display:none!important}.bg-portrait{filter:blur(18px) brightness(.30) saturate(1.08);transform:scale(1.06)}.main-portrait{left:240px;top:560px;width:600px;height:600px;z-index:8;animation:portraitFloat 8s ease-in-out infinite;will-change:transform}.scan-ring{left:50%;top:860px;width:700px;height:700px;margin-left:-350px;margin-top:-350px;z-index:7;animation:ringBreathe 6.5s ease-in-out infinite;will-change:transform,opacity}.cover{z-index:48}.cover-title{top:132px;font-size:70px;right:350px;line-height:1.08}.cover-subtitle{top:338px;right:70px;font-size:29px}.cover-subtitle .strong-line{margin-top:14px}.story-card,.reveal,.traits,.quote,.difference{left:70px;right:70px;z-index:32;box-shadow:0 22px 64px rgba(0,0,0,.42),inset 0 1px 0 rgba(255,255,255,.12)}.story-card{top:1218px;padding:26px;background:linear-gradient(180deg,rgba(6,18,11,.70),rgba(6,18,11,.52));backdrop-filter:blur(10px)}.story-card .scene-title{font-size:43px;line-height:1.15}.chat-stack{margin-top:20px;gap:14px}.chat{font-size:25px;padding:15px 20px}.reveal{top:1218px;padding:26px;background:linear-gradient(180deg,rgba(6,18,11,.70),rgba(6,18,11,.52));backdrop-filter:blur(10px)}.code{font-size:100px}.type-name{font-size:39px}.reveal .scene-copy{font-size:31px!important}.traits{top:1210px}.trait{padding:18px 22px;background:rgba(6,18,11,.62);backdrop-filter:blur(10px)}.trait strong{font-size:28px}.quote{top:1210px}.difference{top:1218px;background:linear-gradient(180deg,rgba(6,18,11,.70),rgba(6,18,11,.52));backdrop-filter:blur(10px)}.fixed-sub-safe{z-index:35}.ending{z-index:70}
@keyframes portraitFloat{0%{transform:translate3d(0,0,0) scale(1)}35%{transform:translate3d(24px,-24px,0) scale(1.026)}70%{transform:translate3d(-18px,18px,0) scale(1.012)}100%{transform:translate3d(0,0,0) scale(1.02)}}
@keyframes ringBreathe{50%{opacity:.78;transform:scale(1.045)}}
@keyframes sceneInOut{0%{opacity:0;transform:translate3d(0,42px,0) scale(.982)}12%,80%{opacity:1;transform:translate3d(0,0,0) scale(1)}100%{opacity:0;transform:translate3d(0,-28px,0) scale(.99)}}
`
}

function buildPinnedScript(): VoiceSegment[] {
  return [
    { text: '如果你每次测 MBTI。', pauseMs: 260 },
    { text: '都觉得它只说中你一半。', pauseMs: 320 },
    { text: '那可能不是你不典型。', pauseMs: 260 },
    { text: '而是传统十六型，太粗了。', pauseMs: 380 },
    { text: '很多人不是完全外向。', pauseMs: 220 },
    { text: '也不是完全内向。', pauseMs: 220 },
    { text: '而是卡在中间。', pauseMs: 420 },
    { text: 'MBTI-PRO，把每个维度都加入中间值。', pauseMs: 260 },
    { text: '从二选一，升级成三选一。', pauseMs: 300 },
    { text: '三的四次方，就是八十一型人格。', pauseMs: 420 },
    { text: '所以你不再只是 ENFJ、INTP，或者 ISFP。', pauseMs: 320 },
    { text: '你可能是更细的平衡型。', pauseMs: 220 },
    { text: '复合型。', pauseMs: 160 },
    { text: '动态型人格。', pauseMs: 320 },
    { text: '不再被四个字母，简单定义。', pauseMs: 420 },
    { text: '每一种人格，都有专属画像。', pauseMs: 220 },
    { text: '九组颜色分类。', pauseMs: 160 },
    { text: '还有深度人格报告。', pauseMs: 320 },
    { text: '也更适合分享给朋友，互相对照。', pauseMs: 420 },
    { text: '如果传统 MBTI，说中了你一半。', pauseMs: 260 },
    { text: '却漏掉了另一半。', pauseMs: 320 },
    { text: '来主页免费测试 MBTI-PRO。', pauseMs: 260 },
    { text: '看看你的八十一型人格。' },
  ]
}
function buildDailyScript(typeData: TypeData): VoiceSegment[] {
  const firstStrength = shorten(typeData.strengths?.[0] || '极强的领导魅力和激励他人成长的能力', 22)
  const growth = shorten(typeData.growthAreas?.[0] || '学会在关心他人和自我照顾之间找到平衡', 24)

  return [
    { text: '你身边有没有这样一个人：他总会在一个很小的瞬间，暴露出自己的独特人格。' },
    { text: '别人只看见表面行为，MBTI-PRO会把它拆成更细的动机、关系和成长方式。' },
    { text: `这就是${typeData.code}，${typeData.name}。传统 16 型只能说中大方向，MBTI-PRO会继续拆到八十一型。` },
    { text: `他们最强的地方，是${firstStrength}。他们看到的不是你现在，而是你还没被看见的潜力。` },
    { text: `但${typeData.name}也要记住：${growth}。你不需要成为每个人的英雄。` },
    { text: '如果这条像你，来主页免费测试，看看你在八十一型里是哪一种。' },
  ]
}

function getPinnedImageCodes() {
  const preferredCodes = ['ENFJ', 'INTP', 'ABCD', 'ANFD', 'ISFP', 'ENTJ', 'IBCD', 'ESFP', 'NCFJ']
  const existingCodes = preferredCodes.filter(code => existsSync(join(IMAGE_DIR, `${code}.jpg`)))
  if (existingCodes.length >= 6) return existingCodes.slice(0, 9)

  const fallbackCodes = readdirSync(IMAGE_DIR)
    .filter(fileName => fileName.toLowerCase().endsWith('.jpg'))
    .map(fileName => fileName.replace(/\.jpg$/i, ''))
    .slice(0, 9)
  return fallbackCodes
}

function buildPinnedHtml(qrDataUrl: string) {
  const imageCodes = getPinnedImageCodes()
  const payload = {
    qrDataUrl,
    images: imageCodes.map((code, index) => ({ code, url: imageUrl(code), delay: `${index * 0.35}s` })),
  }

  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><style>${getSharedCss()}
#stage{--duration:52s;background:radial-gradient(circle at 28% 16%,rgba(83,255,154,.22),transparent 32%),radial-gradient(circle at 80% 64%,rgba(112,90,255,.18),transparent 34%),#020403}.cover{position:absolute;inset:0;z-index:22;animation:coverOut var(--duration) linear forwards}.cover .halo{position:absolute;right:-260px;top:360px;width:850px;height:850px;border-radius:50%;background:radial-gradient(circle,rgba(141,255,182,.24),transparent 62%);filter:blur(8px)}.cover-formula{position:absolute;left:76px;right:76px;top:780px;z-index:26;display:grid;grid-template-columns:1fr 1fr;gap:26px}.formula-card{padding:30px;border-radius:32px}.formula-card small{font-size:24px;color:rgba(255,255,255,.62);font-weight:900}.formula-card strong{display:block;margin-top:8px;font-size:70px;font-weight:1000;letter-spacing:-.05em}.formula-card:nth-child(2){border-color:rgba(141,255,182,.46);box-shadow:0 0 80px rgba(83,255,154,.18)}.formula-card:nth-child(2) strong{color:#8DFFB6}.avatar-grid{position:absolute;inset:0;z-index:4;opacity:.68;filter:saturate(1.08);transform:rotate(-7deg) scale(1.06);animation:avatarDrift var(--duration) ease-in-out forwards;will-change:transform}.avatar-grid img{position:absolute;width:260px;height:260px;border-radius:44px;object-fit:cover;opacity:.82;border:1px solid rgba(255,255,255,.18);box-shadow:0 22px 70px rgba(0,0,0,.45)}.dashboard{position:absolute;left:58px;right:58px;top:250px;z-index:12;opacity:0;animation:sceneInOut 10s ease-in-out 5.2s forwards}.dashboard .panel{padding:38px;border-radius:42px}.big-equation{margin-top:28px;display:flex;align-items:center;justify-content:space-between;gap:18px}.equation-block{flex:1;padding:28px;border-radius:28px;background:rgba(255,255,255,.08);text-align:center}.equation-block small{font-size:24px;color:rgba(255,255,255,.58);font-weight:900}.equation-block strong{display:block;margin-top:8px;font-size:58px;font-weight:1000}.equation-block.active strong{color:#8DFFB6}.middle-values{position:absolute;left:74px;right:74px;top:360px;z-index:13;display:grid;grid-template-columns:repeat(4,1fr);gap:16px;opacity:0;animation:sceneInOut 9s ease-in-out 16.2s forwards}.middle-values div{padding:24px 12px;border-radius:26px;background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.15);text-align:center}.middle-values strong{display:block;font-size:46px;color:#8DFFB6}.middle-values small{display:block;margin-top:8px;font-size:20px;color:rgba(255,255,255,.66);font-weight:800}.report-scene{position:absolute;left:58px;right:58px;top:260px;z-index:14;opacity:0;animation:sceneInOut 11.5s ease-in-out 26.2s forwards}.report-row{margin-top:24px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px}.report-row div{min-height:150px;padding:26px;border-radius:28px;background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.14)}.report-row strong{display:block;font-size:34px}.report-row small{display:block;margin-top:14px;font-size:23px;line-height:1.35;color:rgba(255,255,255,.7);font-weight:800}.scan-line{display:none}.fixed-sub-safe{z-index:10}.ending{animation:endingIn .9s ease-out 42s forwards}
${getPinnedLayoutFixCss()}${getBrandVideoCss('#E8816B')}</style></head><body><div id="stage"><div class="avatar-grid" id="avatarGrid"></div><div class="noise"></div><div class="scan-line"></div><div class="brand"><span class="brand-mark">81</span><span>MBTI-PRO</span></div><div class="page-tag">置顶必看</div><section class="cover"><div class="halo"></div><h1 class="cover-title">你不是不典型<br>是 <em>16型</em> 太粗了</h1><p class="cover-subtitle">如果每次只说中一半，试试 81 型人格。<br><span class="strong-line">MBTI-PRO：从 16 型升级到 81 型</span></p><div class="cover-formula"><div class="formula-card glass"><small>传统 MBTI</small><strong>2⁴ = 16</strong></div><div class="formula-card glass"><small>MBTI-PRO</small><strong>3⁴ = 81</strong></div></div></section><section class="dashboard"><div class="panel glass"><span class="pill">为什么更准</span><h2 class="scene-title" style="margin-top:24px">四个维度，都多了一个中间值</h2><p class="scene-copy" style="margin-top:18px">你说不清的那一半，可能就在中间值里。</p><div class="big-equation"><div class="equation-block"><small>二选一</small><strong>E / I</strong></div><div class="equation-block active"><small>三选一</small><strong>E / A / I</strong></div></div></div></section><section class="middle-values"><div><strong>A</strong><small>平衡能量</small></div><div><strong>B</strong><small>均衡认知</small></div><div><strong>C</strong><small>复合决策</small></div><div><strong>D</strong><small>动态节奏</small></div></section><section class="report-scene"><div class="glass" style="padding:38px;border-radius:42px"><span class="pill">81 型人格图谱</span><h2 class="scene-title" style="margin-top:24px">专属画像、九组颜色、深度报告</h2><div class="report-row"><div><strong>AI 人格画像</strong><small>每个类型一张专属视觉符号</small></div><div><strong>700字画像</strong><small>讲清优势、盲区和成长方向</small></div><div><strong>免费测试</strong><small>无需注册，直接查看结果</small></div></div></div></section><div class="fixed-sub-safe"></div><section class="ending"><h2>主页免费测试<br>你的 81 型人格</h2><p>只说中一半？<br>来 MBTI-PRO 找到更细的那一半。</p><div class="qr-card"><img src="${qrDataUrl}" alt="MBTI-PRO二维码"><strong>扫码 / 主页网址测试</strong></div><div class="site-url">mbti-pro.com</div></section><div class="grain"></div></div><script>const DATA=${safeJson(payload)};const positions=[[70,40],[392,20],[710,55],[110,315],[432,295],[750,335],[70,600],[392,575],[710,615]];const grid=document.getElementById('avatarGrid');DATA.images.forEach((item,index)=>{const image=document.createElement('img');image.src=item.url;image.style.left=positions[index][0]+'px';image.style.top=positions[index][1]+'px';image.style.animationDelay=item.delay;grid.appendChild(image);});</script></body></html>`
}

function buildDailyHtml(typeData: TypeData, qrDataUrl: string) {
  const firstStrength = shorten(typeData.strengths?.[0] || '极强的领导魅力和激励他人成长的能力', 20)
  const secondStrength = shorten(typeData.strengths?.[1] || '出色的共情能力和对他人潜力的准确判断', 20)
  const growth = shorten(typeData.growthAreas?.[0] || '学会在关心他人和自我照顾之间找到平衡', 22)
  const payload = { typeData, qrDataUrl, imageUrl: imageUrl(typeData.code) }
  const quoteLines = splitReadableLines('他看到的不是你现在的样子，而是你可以成为的样子。', 15)

  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><style>${getSharedCss()}
#stage{--duration:48s;background:radial-gradient(circle at 50% 12%,rgba(49,149,84,.38),transparent 32%),radial-gradient(circle at 80% 68%,rgba(141,255,182,.14),transparent 32%),#020403}.bg-portrait{position:absolute;inset:-90px;z-index:1;background:url('${imageUrl(typeData.code)}') center/cover no-repeat;filter:blur(18px) brightness(.34) saturate(1.08);transform:scale(1.04)}.main-portrait{position:absolute;left:220px;top:420px;width:640px;height:640px;border-radius:62px;z-index:6;object-fit:cover;border:1px solid rgba(255,255,255,.2);box-shadow:0 34px 110px rgba(0,0,0,.62),0 0 74px rgba(49,149,84,.2);animation:dailyPortraitMotion var(--duration) ease-in-out forwards;will-change:transform}.cover{position:absolute;inset:0;z-index:24;animation:coverOutShort 5.8s ease-in-out forwards}.cover .main-portrait{top:560px}.story-card{position:absolute;left:70px;right:70px;top:1125px;z-index:12;opacity:0;animation:sceneInOut 9.5s ease-in-out 5.8s forwards;padding:28px;border-radius:38px}.chat-stack{margin-top:26px;display:flex;flex-direction:column;gap:18px}.chat{max-width:760px;padding:20px 24px;border-radius:28px;font-size:30px;line-height:1.3;font-weight:800;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.14)}.chat:nth-child(2){align-self:flex-end;background:rgba(141,255,182,.13);border-color:rgba(141,255,182,.34)}.reveal{position:absolute;left:70px;right:70px;top:1128px;z-index:13;opacity:0;animation:sceneInOut 7s ease-in-out 16s forwards;padding:28px;border-radius:38px}.code{font-size:108px;font-weight:1000;letter-spacing:-.08em;color:#8DFFB6;text-shadow:0 0 66px rgba(83,255,154,.58)}.type-name{font-size:42px;font-weight:1000;margin-top:-8px}.traits{position:absolute;left:70px;right:70px;top:1120px;z-index:14;opacity:0;animation:sceneInOut 9s ease-in-out 24s forwards;display:grid;grid-template-columns:1fr;gap:12px}.trait{padding:22px 26px;border-radius:28px}.trait small{display:block;font-size:22px;color:#8DFFB6;font-weight:900}.trait strong{display:block;margin-top:7px;font-size:32px;line-height:1.22}.quote{position:absolute;left:90px;right:90px;top:1135px;z-index:14;opacity:0;animation:sceneInOut 5.5s ease-in-out 34.2s forwards;text-align:center}.quote p{font-size:42px;line-height:1.25;font-weight:1000;text-shadow:0 14px 50px rgba(0,0,0,.65)}.difference{position:absolute;left:70px;right:70px;top:1130px;z-index:15;opacity:0;animation:sceneInOut 5.5s ease-in-out 40.5s forwards;padding:26px;border-radius:34px;text-align:center}.difference strong{font-size:34px;color:#8DFFB6}.difference p{margin-top:10px;font-size:28px;line-height:1.36;color:rgba(255,255,255,.78);font-weight:800}.scan-ring{position:absolute;left:50%;top:740px;width:720px;height:720px;margin-left:-360px;margin-top:-360px;border:1px solid rgba(141,255,182,.22);border-radius:50%;z-index:5;box-shadow:0 0 42px rgba(83,255,154,.14);opacity:.56}.scan-ring:before,.scan-ring:after{content:'';position:absolute;border-radius:50%;border:1px solid rgba(255,255,255,.14)}.scan-ring:before{inset:54px}.scan-ring:after{inset:120px}.fixed-sub-safe{z-index:10}.ending{animation:endingIn .9s ease-out 46.2s forwards}
${getDailyLayoutFixCss()}${getDailyBrandCss(typeData)}</style></head><body><div id="stage"><div class="bg-portrait"></div><div class="scan-ring"></div><img class="main-portrait" src="${imageUrl(typeData.code)}" alt="${typeData.code}"><div class="brand"><span class="brand-mark">81</span><span>MBTI-PRO</span></div><div class="page-tag">每日人格 · ${typeData.code}</div><section class="cover"><div class="daily-code-badge">${typeData.code}</div><h1 class="cover-title">${typeData.code}<br><em>${typeData.name}</em></h1><p class="cover-subtitle">你身边有没有这样一个 ${typeData.code}？<br><span class="strong-line">${typeData.name} · 情绪共鸣故事</span></p></section><section class="story-card glass"><span class="pill">你身边有没有这样一个人</span><h2 class="scene-title" style="margin-top:22px">${typeData.name}最容易被看见的一面</h2><div class="chat-stack"><div class="chat">“原来我不是奇怪，只是更细的一型。”</div><div class="chat">“16 型说中大方向，81 型补上中间地带。”</div></div></section><section class="reveal glass"><div class="code">${typeData.code}</div><div class="type-name">${typeData.name}</div><p class="scene-copy" style="margin-top:18px">传统 16 型说中大方向，MBTI-PRO 会继续拆到 81 型。</p></section><section class="traits"><div class="trait glass"><small>核心优势 01</small><strong>${firstStrength}</strong></div><div class="trait glass"><small>核心优势 02</small><strong>${secondStrength}</strong></div><div class="trait glass"><small>成长提醒</small><strong>${growth}</strong></div></section><section class="quote"><p>${quoteLines.join('<br>')}</p></section><section class="difference glass"><strong>不只是 ${typeData.code}，而是更细的 81 型人格</strong><p>16 型说中大方向，81 型补上中间地带。</p></section><div class="fixed-sub-safe"></div><section class="ending"><h2>像你吗？<br>主页免费测试</h2><p>测完回来评论区告诉我：<br>你的 81 型人格是哪一型。</p><div class="qr-card"><img src="${qrDataUrl}" alt="MBTI-PRO二维码"><strong>扫码 / 主页网址测试</strong></div><div class="site-url">mbti-pro.com</div></section></div><script>window.SAMPLE_DATA=${safeJson(payload)};</script></body></html>`
}

function buildCoverHtml(spec: RenderSpec, qrDataUrl: string, typeData?: TypeData) {
  const portraitHtml = spec.kind === 'daily' && typeData
    ? `<div class="bg-portrait"></div><img class="cover-person" src="${imageUrl(typeData.code)}" alt="${typeData.code}">`
    : `<div class="cover-grid">${getPinnedImageCodes().slice(0, 6).map(code => `<img src="${imageUrl(code)}" alt="${code}">`).join('')}</div>`

  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><style>${getSharedCss()}
#stage{background:radial-gradient(circle at 42% 18%,rgba(232,129,107,.22),transparent 34%),radial-gradient(circle at 76% 70%,rgba(212,168,83,.18),transparent 38%),linear-gradient(180deg,#FDF8F0 0%,#F3E7D2 62%,#EDE6D8 100%);color:#2D2A26}.bg-portrait{position:absolute;inset:-80px;background:url('${typeData ? imageUrl(typeData.code) : imageUrl('ENFJ')}') center/cover no-repeat;filter:blur(18px) brightness(1.06) saturate(.86) opacity(.22);transform:scale(1.08)}.cover-person{position:absolute;left:185px;top:675px;width:710px;height:710px;border-radius:76px;object-fit:cover;border:10px solid rgba(255,255,255,.72);box-shadow:0 40px 120px rgba(90,72,48,.24),0 0 70px rgba(232,129,107,.16)}.cover-grid{position:absolute;left:80px;right:80px;top:720px;display:grid;grid-template-columns:repeat(3,1fr);gap:18px;transform:rotate(-5deg)}.cover-grid img{width:100%;aspect-ratio:1;border-radius:34px;object-fit:cover;border:8px solid rgba(255,255,255,.70);box-shadow:0 24px 70px rgba(90,72,48,.18)}.cover-title{top:154px;font-size:78px}.cover-subtitle{top:432px;font-size:31px}.cover-subtitle .strong-line{font-size:28px}.qr-mini{position:absolute;right:64px;bottom:72px;z-index:30;padding:16px;border-radius:26px;background:#fff;color:#07120B;text-align:center}.qr-mini img{width:138px;height:138px;display:block}.qr-mini strong{display:block;margin-top:8px;font-size:18px}.bottom-badge{position:absolute;left:64px;right:270px;bottom:82px;z-index:30;font-size:36px;line-height:1.15;font-weight:1000;color:#8DFFB6}.noise,.grain{display:block}
${getBrandVideoCss(typeData?._colorHex || '#E8816B')}
</style></head><body><div id="stage">${portraitHtml}<div class="noise"></div><div class="brand"><span class="brand-mark">81</span><span>MBTI-PRO</span></div><div class="page-tag">${spec.kind === 'pinned' ? '置顶必看' : `每日人格 · ${typeData?.code || ''}`}</div><h1 class="cover-title">${spec.coverTitle}</h1><p class="cover-subtitle">${spec.coverSubtitle}<br><span class="strong-line">主页免费测试 · mbti-pro.com</span></p><div class="bottom-badge">${spec.kind === 'pinned' ? '16型 → 81型人格' : `${typeData?.code || ''} · ${typeData?.name || ''}`}</div><div class="qr-mini"><img src="${qrDataUrl}" alt="二维码"><strong>免费测试</strong></div><div class="grain"></div></div></body></html>`
}

async function renderHtmlVideo(html: string, slug: string, durationSeconds: number) {
  const renderDir = join(WORK_DIR, slug, 'recording')
  ensureDir(renderDir)
  for (const fileName of readdirSync(renderDir).filter(name => name.endsWith('.webm'))) {
    try { unlinkSync(join(renderDir, fileName)) } catch {}
  }

  const htmlPath = join(renderDir, `${slug}.html`)
  writeFileSync(htmlPath, html, 'utf-8')

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1080, height: 1920 },
    deviceScaleFactor: 2,
    recordVideo: { dir: renderDir, size: { width: 1080, height: 1920 } },
  })
  const page = await context.newPage()
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(durationSeconds * 1000)
  await page.close()
  await context.close()
  await browser.close()

  const webmFile = readdirSync(renderDir).find(fileName => fileName.endsWith('.webm'))
  if (!webmFile) throw new Error(`录屏失败：${slug}`)
  const sourcePath = join(renderDir, webmFile)
  const targetPath = join(renderDir, `${slug}.webm`)
  if (sourcePath !== targetPath) renameSync(sourcePath, targetPath)
  return targetPath
}

async function renderCover(html: string, outputPath: string) {
  const coverDir = join(WORK_DIR, 'covers')
  ensureDir(coverDir)
  const htmlPath = join(coverDir, `${outputPath.split(/[\\/]/).pop()}.html`)
  writeFileSync(htmlPath, html, 'utf-8')

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 2 })
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  await page.screenshot({ path: outputPath, type: 'png' })
  await browser.close()
}

async function probeAudioSeconds(audioPath: string) {
  return new Promise<number>((resolveProbe) => {
    const processHandle = spawn(FFMPEG_PATH, ['-i', audioPath], { stdio: 'pipe' })
    let stderr = ''
    processHandle.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString() })
    processHandle.on('close', () => {
      const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+)\.(\d+)/)
      if (!match) return resolveProbe(45)
      const seconds = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(`0.${match[4]}`)
      resolveProbe(seconds)
    })
    processHandle.on('error', () => resolveProbe(45))
  })
}

async function renderSpec(spec: RenderSpec, qrDataUrl: string, typeData?: TypeData) {
  console.log(`\n🎬 生成审核样片：${spec.title}`)
  const sampleDir = join(WORK_DIR, spec.slug)
  const audioDir = join(sampleDir, 'audio')
  ensureDir(sampleDir)
  ensureDir(audioDir)
  ensureDir(OUTPUT_DIR)

  console.log('  [1/5] 生成配音和字幕...')
  const { audioPath, subtitlePath } = await generateVoiceover(spec.voiceSegments, audioDir, spec.slug)
  const audioSeconds = await probeAudioSeconds(audioPath)
  const durationSeconds = Math.max(spec.durationSeconds, Math.ceil(audioSeconds + 1.2))

  console.log(`  [2/5] 录制动态画面 (${durationSeconds}s)...`)
  const webmPath = await renderHtmlVideo(spec.html, spec.slug, durationSeconds)

  console.log('  [3/5] 转换 MP4...')
  const tempMp4 = join(sampleDir, `${spec.slug}_novoice.mp4`)
  await convertWebmToMp4(webmPath, tempMp4, 1080, 1920)

  console.log('  [4/5] 合成音频和字幕...')
  const finalMp4 = join(OUTPUT_DIR, `${spec.slug}.mp4`)
  await muxAudioAndSubtitles(tempMp4, audioPath, subtitlePath, finalMp4)
  try { unlinkSync(tempMp4) } catch {}

  console.log('  [5/5] 生成封面图...')
  const coverPath = join(OUTPUT_DIR, `cover_${spec.slug}.png`)
  await renderCover(buildCoverHtml(spec, qrDataUrl, typeData), coverPath)

  console.log(`  ✅ 视频：${finalMp4}`)
  console.log(`  ✅ 封面：${coverPath}`)
  console.log(`  ✅ 字幕：${subtitlePath}`)
  return { finalMp4, coverPath, subtitlePath }
}

async function main() {
  const options = parseArgs()
  ensureDir(WORK_DIR)
  ensureDir(OUTPUT_DIR)

  const typeData = loadTypeData(options.typeCode)
  const qrDataUrl = await generateQrDataUrl()

  const pinnedSpec: RenderSpec = {
    kind: 'pinned',
    slug: 'MBTI-PRO_pinned_review',
    durationSeconds: 52,
    title: '置顶推广视频',
    coverTitle: '你不是不典型<br>是 <em>16型</em> 太粗了',
    coverSubtitle: '如果 MBTI 只说中一半，试试 81 型人格。',
    voiceSegments: buildPinnedScript(),
    html: buildPinnedHtml(qrDataUrl),
  }

  const dailySpec: RenderSpec = {
    kind: 'daily',
    slug: `${typeData.code}_daily_review`,
    durationSeconds: 45,
    title: `${typeData.code} 每日人格视频`,
    coverTitle: `${typeData.code}<br><em>${typeData.name}</em>`,
    coverSubtitle: `${typeData.code} · ${typeData.name}｜81 型人格故事。`,
    voiceSegments: buildDailyScript(typeData),
    html: buildDailyHtml(typeData, qrDataUrl),
  }

  const specs = options.kind === 'pinned'
    ? [pinnedSpec]
    : options.kind === 'daily'
      ? [dailySpec]
      : [pinnedSpec, dailySpec]

  const results = []
  for (const spec of specs) {
    results.push(await renderSpec(spec, qrDataUrl, spec.kind === 'daily' ? typeData : undefined))
  }

  console.log('\n🎉 审核样片生成完成')
  for (const result of results) {
    console.log(`  视频: ${result.finalMp4}`)
    console.log(`  封面: ${result.coverPath}`)
  }
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})










