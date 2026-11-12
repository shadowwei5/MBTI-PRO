// ============================================================
// MBTI-PRO · 竖版封面 → 抖音横版封面 1920×1080 转换器
// 输入：video/output/cover_<code>_daily_liuyuxi_clean.png (1080×1920)
// 输出：video/output/cover_<code>_daily_landscape.png (1920×1080)
// ============================================================
import { existsSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import sharp from 'sharp'

const ROOT = resolve(import.meta.dirname, '..', '..')
const OUT_DIR = join(ROOT, 'video', 'output')

const LANDSCAPE_WIDTH = 1920
const LANDSCAPE_HEIGHT = 1080

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

  const candidates = source
    ? [source]
    : [
        join(OUT_DIR, `cover_${code}_daily_liuyuxi_clean.png`),
        join(OUT_DIR, `cover_${code}_daily_${new Date().toISOString().slice(0,10)}_review_chattts15_nolaugh.png`),
        join(OUT_DIR, `cover_${code}_v4.png`),
        join(OUT_DIR, `cover_${code}.png`),
      ]
  const srcPath = candidates.find(p => existsSync(p))
  if (!srcPath) throw new Error(`未找到竖版封面：\n  ${candidates.join('\n  ')}`)

  const outPath = join(OUT_DIR, `cover_${code}_daily_landscape.png`)
  console.log(`[cover-landscape] 源：${srcPath}`)
  console.log(`[cover-landscape] 输出：${outPath}`)

  // 步骤 1：取原图左右各 120px 条带 → 高斯模糊 → 拉伸填充画布两侧
  // 步骤 2：原图居中放置（等比缩放到高度 1080，宽度 ~607，左右各留 ~656px 渐变过渡带）
  // 步骤 3：叠加标题重排（放在左侧，大字左对齐）
  // 步骤 4：QR 码移到右下角

  // 先获取原图尺寸
  const srcMeta = await sharp(srcPath).metadata()
  const srcW = srcMeta.width!
  const srcH = srcMeta.height!
  console.log(`[cover-landscape] 原图：${srcW}×${srcH}`)

  // 缩放原图到高度 = 1080，保持比例
  const scale = LANDSCAPE_HEIGHT / srcH
  const scaledW = Math.round(srcW * scale)
  console.log(`[cover-landscape] 居中缩放：${scaledW}×${LANDSCAPE_HEIGHT} (scale=${scale.toFixed(3)})`)

  // 左右过渡带宽度
  const sideW = Math.floor((LANDSCAPE_WIDTH - scaledW) / 2)

  // 生成模糊背景：取原图左右各 80px → 模糊 → 拉伸到 sideW×1080 → 叠上渐变半透明蒙版
  const leftStrip = sharp(srcPath)
    .extract({ left: 0, top: Math.floor(srcH * 0.25), width: 80, height: Math.floor(srcH * 0.5) })
    .resize(sideW, LANDSCAPE_HEIGHT, { fit: 'fill' })
    .blur(60)
    .modulate({ brightness: 1.05, saturation: 0.85 })

  const rightStrip = sharp(srcPath)
    .extract({ left: srcW - 80, top: Math.floor(srcH * 0.25), width: 80, height: Math.floor(srcH * 0.5) })
    .resize(sideW, LANDSCAPE_HEIGHT, { fit: 'fill' })
    .blur(60)
    .modulate({ brightness: 1.05, saturation: 0.85 })

  // 构建 canvas：渐变底 + 左右模糊条 + 居中主图
  const base = sharp({ create: { width: LANDSCAPE_WIDTH, height: LANDSCAPE_HEIGHT, channels: 4, background: { r: 255, g: 253, b: 247, alpha: 1 } } })

  const leftStripBuf = await leftStrip.png().toBuffer()
  const rightStripBuf = await rightStrip.png().toBuffer()
  const centerBuf = await sharp(srcPath).resize(scaledW, LANDSCAPE_HEIGHT).png().toBuffer()

  // 叠加：左条 → 右条 → 居中主图
  const compositeLayers: sharp.OverlayOptions[] = []
  if (sideW > 0) {
    compositeLayers.push({ input: leftStripBuf, left: 0, top: 0, blend: 'over' })
    compositeLayers.push({ input: rightStripBuf, left: LANDSCAPE_WIDTH - sideW, top: 0, blend: 'over' })
  }
  compositeLayers.push({ input: centerBuf, left: sideW, top: 0, blend: 'over' })

  await base
    .composite(compositeLayers)
    .png({ quality: 92, compressionLevel: 6 })
    .toFile(outPath)

  console.log(`✅ 横版封面：${outPath}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
