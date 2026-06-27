// ============================================================
// MBTI-PRO Video Pipeline — 封面图自动生成
// 支持两种模式:
//   1. 通用封面 (default): 不指定人格，显示 "???" 制造好奇心
//   2. 类型封面 (per-type): 自动填入人格代码+颜色+名称
// ============================================================
import { chromium } from 'playwright'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { PersonalityTypeData } from './types.js'
import { getTypeColor, getNineGroupCode, getNineGroupColor } from './utils/colors.js'

const NINE_COLORS = ['#C8963E','#D4782F','#2C5F8A','#4A4A4A','#8B95A0','#B8956A','#6B3FA0','#3D7B8A','#2D8A4E']
const OUTPUT_DIR = join(import.meta.dirname, '..', '..', 'video', 'output')

function ensureDir(d: string) { if (!existsSync(d)) mkdirSync(d, { recursive: true }) }

/** 生成封面图 */
async function renderCoverHtml(html: string, outputPath: string, width: number, height: number) {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 })
  await page.setContent(html, { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  await page.screenshot({ path: outputPath, type: 'png' })
  await browser.close()
  console.log(`[cover] ${outputPath}`)
}

/** 生成通用封面（"???" 好奇驱动） */
export async function generateDefaultCover(): Promise<string> {
  ensureDir(OUTPUT_DIR)
  const outPath = join(OUTPUT_DIR, 'cover_default.png')

  const dotStrip = NINE_COLORS.map(c => `<div style="width:24px;height:24px;border-radius:7px;background:${c}"></div>`).join('')
  const html = `<!DOCTYPE html><html lang="zh"><head><meta charset="UTF-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:1024px;height:1365px;overflow:hidden;font-family:'Noto Sans SC','PingFang SC',sans-serif;background:#0D0D0D}
.c{width:1024px;height:1365px;position:relative;overflow:hidden;
background:linear-gradient(170deg,#1a1a2e 0%,#16213e 38%,#0f3460 72%,#0D0D0D 100%)}
.brand{position:absolute;top:56px;left:50%;transform:translateX(-50%);z-index:3;display:flex;align-items:center;gap:10px}
.brand-text{font-size:52px;font-weight:700;color:#FFF;letter-spacing:.04em;white-space:nowrap}
.zone{position:absolute;top:50%;left:50%;transform:translate(-50%,-55%);z-index:3;text-align:center}
.code{font-family:'Georgia',serif;font-size:200px;font-weight:700;color:#FFF;letter-spacing:.08em;line-height:1;text-shadow:0 6px 60px rgba(0,0,0,.5)}
.name{font-size:52px;font-weight:700;color:rgba(255,255,255,.85);margin-top:20px}
.tag{display:inline-block;margin-top:18px;padding:8px 24px;border-radius:20px;font-size:26px;font-weight:600;background:rgba(255,255,255,.08);color:#E8816B}
.cta{position:absolute;bottom:70px;left:50%;transform:translateX(-50%);z-index:3;text-align:center;font-size:28px;color:rgba(255,255,255,.5)}
.ds{position:absolute;bottom:190px;left:50%;transform:translateX(-50%);display:flex;gap:7px;z-index:3}
</style></head><body><div class="c">
<div class="brand"><span class="brand-text">MBTI-PRO · 81 型人格测试</span></div>
<div class="zone"><div class="code">???</div><div class="name">你是什么人格类型？</div><div class="tag">免费测试 · 发现真实的自己</div></div>
<div class="ds">${dotStrip}</div>
</div></body></html>`

  await renderCoverHtml(html, outPath, 1024, 1365)
  return outPath
}

/** 生成指定人格类型的封面 */
export async function generateTypeCover(typeData: PersonalityTypeData): Promise<string> {
  ensureDir(OUTPUT_DIR)
  const code = typeData.code
  const outPath = join(OUTPUT_DIR, `cover_${code}.png`)

  const colorInfo = getTypeColor(code)
  const groupCode = getNineGroupCode(code)
  const groupInfo = getNineGroupColor(groupCode)

  const dotStrip = NINE_COLORS.map(c =>
    `<div style="width:24px;height:24px;border-radius:7px;background:${c};${c===groupInfo.hex?'box-shadow:0 0 16px '+c+';transform:scale(1.25)':''}"></div>`
  ).join('')

  const html = `<!DOCTYPE html><html lang="zh"><head><meta charset="UTF-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:1024px;height:1365px;overflow:hidden;font-family:'Noto Sans SC','PingFang SC',sans-serif;background:#0D0D0D}
.c{width:1024px;height:1365px;position:relative;overflow:hidden;
background:linear-gradient(170deg,#1a1a2e 0%,#16213e 38%,${colorInfo.hex}22 72%,#0D0D0D 100%)}
.brand{position:absolute;top:56px;left:50%;transform:translateX(-50%);z-index:3;display:flex;align-items:center;gap:10px}
.brand-text{font-size:52px;font-weight:700;color:#FFF;letter-spacing:.04em;white-space:nowrap}
.zone{position:absolute;top:50%;left:50%;transform:translate(-50%,-55%);z-index:3;text-align:center}
.code{font-family:'Georgia',serif;font-size:200px;font-weight:700;color:${colorInfo.hex};letter-spacing:.08em;line-height:1;text-shadow:0 6px 60px rgba(0,0,0,.5)}
.name{font-size:52px;font-weight:700;color:rgba(255,255,255,.85);margin-top:20px}
.tag{display:inline-block;margin-top:18px;padding:8px 24px;border-radius:20px;font-size:26px;font-weight:600;background:${colorInfo.hex}22;color:${colorInfo.hex};border:1px solid ${colorInfo.hex}44}
.ds{position:absolute;bottom:190px;left:50%;transform:translateX(-50%);display:flex;gap:7px;z-index:3}
</style></head><body><div class="c">
<div class="brand"><span class="brand-text">MBTI-PRO · 81 型人格测试</span></div>
<div class="zone"><div class="code">${code}</div><div class="name">${typeData.name}</div><div class="tag">${groupInfo.name}</div></div>
<div class="ds">${dotStrip}</div>
</div></body></html>`

  await renderCoverHtml(html, outPath, 1024, 1365)
  return outPath
}
