/**
 * 图片预处理脚本 — 生成两档尺寸：
 * 1. 缩略图 320px WebP → 首页网格 (~4KB/张)
 * 2. 中图 640px WebP → 详情页+海报 (~15KB/张)
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const imagesDir = path.resolve(__dirname, '..', 'generated_images')
const thumbsDir = path.resolve(imagesDir, 'thumbs')
const mediumsDir = path.resolve(imagesDir, 'mediums')

fs.mkdirSync(thumbsDir, { recursive: true })
fs.mkdirSync(mediumsDir, { recursive: true })

const files = fs.readdirSync(imagesDir).filter(f => {
  const name = path.basename(f, '.jpg')
  return /^[EIA][NSB][TFC][JPD]$/.test(name) && !name.includes('_')
})

console.log(`[images] ${files.length} 张标准类型图片`)

async function processOne(
  file: string, width: number, quality: number, outDir: string, label: string
): Promise<number> {
  const inputPath = path.join(imagesDir, file)
  const outputPath = path.join(outDir, file.replace('.jpg', '.webp'))
  try {
    const srcStat = fs.statSync(inputPath)
    try {
      if (fs.statSync(outputPath).mtime > srcStat.mtime) return 0 // skipped
    } catch {}
  } catch { return 0 }

  await sharp(inputPath)
    .resize(width, Math.round(width * 0.75), { fit: 'cover', position: 'center' })
    .webp({ quality })
    .toFile(outputPath)
  return 1
}

async function main() {
  let tCount = 0, mCount = 0

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    tCount += await processOne(file, 320, 75, thumbsDir, 'thumb')
    mCount += await processOne(file, 640, 85, mediumsDir, 'medium')
    if ((i + 1) % 20 === 0) console.log(`[images] 进度: ${i + 1}/${files.length}`)
  }

  console.log(`[images] 完成: 缩略图 ${tCount} 生成, 中图 ${mCount} 生成`)

  // 示例对比
  if (files.length > 0) {
    const s = files[0]
    const o = (fs.statSync(path.join(imagesDir, s)).size / 1024).toFixed(0)
    const t = (fs.statSync(path.join(thumbsDir, s.replace('.jpg', '.webp'))).size / 1024).toFixed(0)
    const m = (fs.statSync(path.join(mediumsDir, s.replace('.jpg', '.webp'))).size / 1024).toFixed(0)
    console.log(`[images] ${s}: ${o}KB → 缩略图${t}KB / 中图${m}KB`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
