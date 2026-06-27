// ============================================================
// MBTI-PRO 抖音账号视觉素材生成 v2
// 头像 200×200 (重新设计) / 背景 1080×480 / 封面模板 1024×1365
// ============================================================
import { chromium } from 'playwright'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const OUTPUT_DIR = join(import.meta.dirname, '..', '..', 'video', 'assets')
const NINE_COLORS = ['#C8963E','#D4782F','#2C5F8A','#4A4A4A','#8B95A0','#B8956A','#6B3FA0','#3D7B8A','#2D8A4E']

function ensureDir(d: string) { if (!existsSync(d)) mkdirSync(d, { recursive: true }) }

async function renderAsset(name: string, html: string, width: number, height: number) {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 })
  await page.setContent(html, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const outPath = join(OUTPUT_DIR, name)
  await page.screenshot({ path: outPath, type: 'png' })
  console.log(`[assets] ${name} (${width}×${height})`)
  await browser.close()
}

// ─── 头像 v3: 200×200 ───
// 设计要点: MBTI PRO 为主视觉 / 81 为点缀 / 9 色光环加粗可见
const nineGradient = NINE_COLORS.join(',')
const AVATAR_HTML = `<!DOCTYPE html><html lang="zh"><head><meta charset="UTF-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:200px;height:200px;overflow:hidden;background:transparent}
.c{
  width:200px;height:200px;border-radius:50%;position:relative;overflow:hidden;
  background:linear-gradient(145deg,#14142a 0%,#1a1e3a 50%,#0f1530 100%);
}
/* 9 色光环 — 粗环，透明中心→64%处开始可见 = 约 14px 环宽 */
.ring{
  position:absolute;inset:3px;border-radius:50%;z-index:1;
  background:conic-gradient(from -20deg,${nineGradient},${NINE_COLORS[0]});
  -webkit-mask:radial-gradient(circle,transparent 64%,#000 76%);
  mask:radial-gradient(circle,transparent 64%,#000 76%);
  opacity:.92;
}
/* 文字区域: MBTI PRO 为主 */
.txt{position:absolute;inset:0;z-index:3;display:flex;flex-direction:column;align-items:center;justify-content:center}
.label{font-size:24px;font-weight:700;color:#FFF;letter-spacing:.08em;line-height:1}
.sub{font-size:13px;font-weight:400;color:rgba(255,255,255,.5);letter-spacing:.16em;margin-top:3px}
</style></head><body>
<div class="c">
<div class="ring"></div>
<div class="txt"><div class="label">MBTI</div><div class="sub">PRO · 81 型</div></div>
</div>
</body></html>`

// ─── 背景图: 1080×480 ───
const bgDots = NINE_COLORS.map(c => `<div style="width:32px;height:32px;border-radius:10px;background:${c};opacity:.9"></div>`).join('')
const BG_HTML = `<!DOCTYPE html><html lang="zh"><head><meta charset="UTF-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:1080px;height:480px;overflow:hidden;font-family:'Noto Sans SC','PingFang SC',sans-serif;background:#0D0D0D}
.bg{width:1080px;height:480px;position:relative;overflow:hidden;
background:linear-gradient(160deg,#1a1a2e 0%,#16213e 55%,#0f3460 100%)}
.dots{position:absolute;top:80px;left:50%;transform:translateX(-50%);display:flex;gap:14px;z-index:2}
.colors{position:absolute;bottom:100px;left:50%;transform:translateX(-50%);z-index:2;text-align:center}
.title{font-size:52px;font-weight:900;color:#FFF;letter-spacing:.1em}
.sub{font-size:24px;color:rgba(255,255,255,.45);margin-top:14px;letter-spacing:.06em}
.particle{position:absolute;border-radius:50%;background:rgba(255,255,255,.04)}
.p1{width:90px;height:90px;top:8%;left:3%}.p2{width:140px;height:140px;bottom:3%;right:2%}.p3{width:55px;height:55px;top:35%;left:82%}
</style></head><body>
<div class="bg">
<div class="particle p1"></div><div class="particle p2"></div><div class="particle p3"></div>
<div class="dots">${bgDots}</div>
<div class="colors"><div class="title">MBTI · PRO</div><div class="sub">全新的 81 型人格分类体系  ·  比传统精准 5 倍</div></div>
</div>
</body></html>`

// ─── 封面模板: 1024×1365 (3:4) ───
const coverDots = NINE_COLORS.map(c => `<div style="width:24px;height:24px;border-radius:7px;background:${c}"></div>`).join('')
const COVER_HTML = `<!DOCTYPE html><html lang="zh"><head><meta charset="UTF-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:1024px;height:1365px;overflow:hidden;font-family:'Noto Sans SC','PingFang SC',sans-serif;background:#0D0D0D}
.c{width:1024px;height:1365px;position:relative;overflow:hidden;
background:linear-gradient(170deg,#1a1a2e 0%,#16213e 38%,#0f3460 72%,#0D0D0D 100%)}
.brand{position:absolute;top:56px;left:50%;transform:translateX(-50%);z-index:3;display:flex;align-items:center;gap:10px}
.brand-dot{width:12px;height:12px;border-radius:50%;background:#E8816B}
.brand-text{font-size:40px;font-weight:700;color:#FFF;letter-spacing:.06em}
.type-zone{position:absolute;top:50%;left:50%;transform:translate(-50%,-55%);z-index:3;text-align:center}
.code{font-family:'Georgia','Times New Roman',serif;font-size:200px;font-weight:700;color:#FFF;letter-spacing:.08em;line-height:1;text-shadow:0 6px 50px rgba(0,0,0,.45)}
.name{font-size:52px;font-weight:700;color:rgba(255,255,255,.85);margin-top:20px}
.group-tag{display:inline-block;margin-top:18px;padding:8px 24px;border-radius:20px;font-size:26px;font-weight:600;letter-spacing:.04em}
.cta{position:absolute;bottom:70px;left:50%;transform:translateX(-50%);z-index:3;text-align:center}
.cta-text{font-size:28px;color:rgba(255,255,255,.5)}
.dot-strip{position:absolute;bottom:190px;left:50%;transform:translateX(-50%);display:flex;gap:7px;z-index:3}
</style></head><body>
<div class="c">
<div class="brand"><span class="brand-dot"></span><span class="brand-text">MBTI-PRO · 81 型人格测试</span></div>
<div class="type-zone"><div class="code" id="code">???</div><div class="name" id="name">你是什么人格类型？</div><div class="group-tag" id="tag" style="background:rgba(255,255,255,.08);color:#E8816B">免费测试 · 发现真实的自己</div></div>
<div class="dot-strip">${coverDots}</div>
</div>
</body></html>`

async function main() {
  ensureDir(OUTPUT_DIR)
  console.log('[assets] 生成视觉素材 v2...\n')

  await renderAsset('avatar_200x200.png', AVATAR_HTML, 200, 200)
  await renderAsset('bg_1080x480.png', BG_HTML, 1080, 480)
  await renderAsset('cover_template_1024x1365.png', COVER_HTML, 1024, 1365)

  console.log(`\n[assets] ✅ 全部完成 → ${OUTPUT_DIR}`)
}

main().catch(e => { console.error(e); process.exit(1) })
