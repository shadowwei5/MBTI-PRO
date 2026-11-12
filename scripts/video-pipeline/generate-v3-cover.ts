import { chromium } from 'playwright'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'

const ROOT = join(import.meta.dirname, '..', '..')
const OUTPUT_DIR = join(ROOT, 'video', 'output')
const WORK_DIR = join(ROOT, 'video', 'work')
const IMAGE_DIR = join(ROOT, 'video', '81_image')
const QR_URL = 'https://mbti-pro.com/?utm_source=douyin&utm_medium=cover&utm_campaign=personality_daily'
const requireFromClient = createRequire(join(ROOT, 'client', 'package.json'))
let QRCode: any
try { QRCode = requireFromClient('qrcode') } catch {}

function esc(value: string) {
  return String(value || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}

function imageDataUrl(filePath: string): string {
  if (!existsSync(filePath)) return ''
  const ext = filePath.toLowerCase().endsWith('.webp') ? 'webp' : 'jpeg'
  return `data:image/${ext};base64,${readFileSync(filePath).toString('base64')}`
}

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`
}

function buildQrSvg(url: string): string {
  if (!QRCode) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="210" height="210" viewBox="0 0 210 210"><rect width="100%" height="100%" fill="#fff"/><text x="50%" y="50%" text-anchor="middle" font-family="Arial" font-size="18" font-weight="700" fill="#2F261B">mbti-pro.com</text></svg>'
  }
  const qr = QRCode.create(url, { errorCorrectionLevel: 'M' })
  const modules = qr.modules.size
  const margin = 4
  const cell = 8
  const size = (modules + margin * 2) * cell
  const rects: string[] = []
  for (let y = 0; y < modules; y++) {
    for (let x = 0; x < modules; x++) {
      if (qr.modules.get(x, y)) rects.push(`<rect x="${(x + margin) * cell}" y="${(y + margin) * cell}" width="${cell}" height="${cell}"/>`)
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="100%" height="100%" fill="#fff"/><g fill="#2F261B">${rects.join('')}</g></svg>`
}

async function main() {
  const code = (process.argv[2] || 'ENFJ').toUpperCase()
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true })
  const data = JSON.parse(readFileSync(join(WORK_DIR, code, `${code}.json`), 'utf8'))
  const marketing = data.marketing || {}
  const portrait = imageDataUrl(join(IMAGE_DIR, `${code}.jpg`))
  const qr = svgToDataUrl(buildQrSvg(QR_URL))
  const accent = data._colorHex || '#319554'
  const outPath = join(OUTPUT_DIR, `cover_${code}_v4.png`)
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0;padding:0}body{width:1080px;height:1440px;overflow:hidden;font-family:"Noto Sans SC","Microsoft YaHei",sans-serif;background:#F8EEDC;color:#2F261B}.c{position:relative;width:1080px;height:1440px;overflow:hidden;background:radial-gradient(circle at 82% 10%,#fff8 0 14%,transparent 34%),radial-gradient(circle at 12% 84%,${accent}26,transparent 34%),linear-gradient(180deg,#FFF8EC,#F4DFBB)}.c:before{content:"";position:absolute;inset:42px;border:1px solid #E7D4B7;border-radius:54px}.brand{position:absolute;top:64px;left:74px;right:74px;display:flex;align-items:flex-start;justify-content:space-between;color:#8B5E2E;font-weight:900;font-size:28px;letter-spacing:.08em}.right{display:flex;gap:14px;align-items:flex-start}.pill{border:1px solid #E7D4B7;background:#fff9;border-radius:999px;padding:12px 20px;font-size:22px;white-space:nowrap}.qr{width:88px;height:88px;border-radius:18px;background:#fff;padding:7px;border:1px solid #E7D4B7;box-shadow:0 10px 28px rgba(122,88,44,.12)}.code{position:absolute;top:142px;left:72px;font-family:Georgia,serif;font-size:172px;font-weight:900;letter-spacing:.03em;color:${accent};text-shadow:0 22px 60px ${accent}55}.name{position:absolute;top:306px;left:82px;font-size:36px;font-weight:800;color:#7B6A54}.img{position:absolute;top:390px;left:300px;width:480px;height:570px;border-radius:42px;overflow:hidden;background:#fff;border:1px solid #E7D4B7;box-shadow:0 36px 110px rgba(122,88,44,.20)}.img img{width:100%;height:100%;object-fit:cover;object-position:center 42%;display:block}.title{position:absolute;left:72px;right:72px;bottom:300px;font-size:82px;line-height:1.04;font-weight:950;letter-spacing:-.055em}.hook{position:absolute;left:72px;right:72px;bottom:184px;font-size:58px;line-height:1.12;font-weight:950;color:#fff;background:#2F261B;border-radius:28px;padding:22px 30px;box-shadow:0 22px 60px rgba(47,38,27,.20)}.sub{position:absolute;left:76px;right:76px;bottom:112px;font-size:32px;font-weight:800;color:#7B6A54}.footer{position:absolute;left:76px;right:76px;bottom:54px;display:flex;justify-content:space-between;align-items:center;color:#8B5E2E;font-size:24px;font-weight:900}.dot{width:28px;height:28px;border-radius:10px;background:linear-gradient(135deg,${accent},#D8B66F);display:inline-block;margin-right:12px;vertical-align:-5px}</style></head><body><div class="c"><div class="brand"><div><span class="dot"></span>MBTI-PRO</div><div class="right"><div class="pill">81 型人格 · 免费测</div><img class="qr" src="${qr}"></div></div><div class="code">${esc(code)}</div><div class="name">${esc(data.name || '')}</div><div class="img"><img id="portrait" src="${portrait}"></div><div class="title">${esc(marketing.coverTitle || `${code} 放不下的`)}</div><div class="hook">${esc(marketing.coverHook || '是让他终于不用逞强的人')}</div><div class="sub">${esc(marketing.coverSubtitle || '主页免费测 81 型人格')}</div><div class="footer"><span>主页免费测试</span><span>mbti-pro.com</span></div></div></body></html>`
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1080, height: 1440 }, deviceScaleFactor: 2 })
  await page.setContent(html, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => {
    const img = document.getElementById('portrait') as HTMLImageElement | null
    return !img || (img.complete && img.naturalWidth > 0)
  }, undefined, { timeout: 5000 }).catch(() => console.warn('[cover] 人格图片未确认加载完成'))
  await page.screenshot({ path: outPath, type: 'png' })
  await browser.close()
  console.log(outPath)
}
main().catch((error) => { console.error(error); process.exit(1) })
