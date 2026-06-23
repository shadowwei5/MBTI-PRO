/**
 * 缩略图预生成脚本 — 首页性能优化核心
 * 遍历 generated_images/ 下所有标准类型 JPG，生成 320px WebP 缩略图到 thumbs/
 * 每张从 ~300KB 降到 ~10KB（约 30x 压缩）
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const imagesDir = path.resolve(__dirname, '..', 'generated_images')
const thumbsDir = path.resolve(imagesDir, 'thumbs')

fs.mkdirSync(thumbsDir, { recursive: true })

const files = fs.readdirSync(imagesDir).filter(f => {
  const name = path.basename(f, '.jpg')
  return /^[EIA][NSB][TFC][JPD]$/.test(name) && !name.includes('_')
})

console.log(`[thumbs] ${files.length} 张标准类型图片`)

let count = 0
let skipped = 0

for (const file of files) {
  const inputPath = path.join(imagesDir, file)
  const outputPath = path.join(thumbsDir, file.replace('.jpg', '.webp'))

  try {
    const srcStat = fs.statSync(inputPath)
    try {
      const thumbStat = fs.statSync(outputPath)
      if (thumbStat.mtime > srcStat.mtime) { skipped++; continue }
    } catch {}
  } catch { continue }

  try {
    await sharp(inputPath)
      .resize(320, 240, { fit: 'cover', position: 'center' })
      .webp({ quality: 75 })
      .toFile(outputPath)
    count++
    if (count % 20 === 0) console.log(`[thumbs] ${count}/${files.length}`)
  } catch (err: any) {
    console.error(`[thumbs] ${file} 失败: ${err.message}`)
  }
}

console.log(`[thumbs] 完成: ${count} 生成, ${skipped} 跳过`)

// 示例对比
if (files.length > 0) {
  const s = files[0]
  const o = fs.statSync(path.join(imagesDir, s)).size
  const t = fs.statSync(path.join(thumbsDir, s.replace('.jpg', '.webp'))).size
  console.log(`[thumbs] ${s}: ${(o/1024).toFixed(0)}KB → ${(t/1024).toFixed(0)}KB (${((1-t/o)*100).toFixed(0)}%)`)
}
