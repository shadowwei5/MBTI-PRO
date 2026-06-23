/**
 * 缩略图预生成脚本
 * 遍历 generated_images/ 下所有 JPG，生成 320px 宽 WebP 缩略图到 generated_images/thumbs/
 * 用于首页网格展示，将每张图片从 250-400KB 降到 5-15KB
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const imagesDir = path.resolve(__dirname, '..', 'generated_images')
const thumbsDir = path.resolve(imagesDir, 'thumbs')

// 确保缩略图目录存在
fs.mkdirSync(thumbsDir, { recursive: true })

// 只处理标准 4 字母类型码的 JPG（跳过 _bak_skin、_backup 等变体）
const files = fs.readdirSync(imagesDir).filter(f => {
  const name = path.basename(f, '.jpg')
  return /^[EIA][NSB][TFC][JPD]$/.test(name) && !name.includes('_')
})

console.log(`[thumbs] 找到 ${files.length} 张标准类型图片`)

// 检测 sharp 是否可用
let sharp: any = null
try {
  sharp = (await import('sharp')).default
  console.log('[thumbs] 使用 sharp 生成 WebP 缩略图')
} catch {
  console.log('[thumbs] sharp 未安装，使用 ImageMagick convert 降级方案')
}

let count = 0
let skipped = 0

for (const file of files) {
  const inputPath = path.join(imagesDir, file)
  const outputPath = path.join(thumbsDir, file.replace('.jpg', '.webp'))

  // 如果缩略图已存在且比源文件新，跳过
  try {
    const srcStat = fs.statSync(inputPath)
    const thumbStat = fs.statSync(outputPath)
    if (thumbStat.mtime > srcStat.mtime) {
      skipped++
      continue
    }
  } catch {
    /* 缩略图不存在，继续生成 */
  }

  try {
    if (sharp) {
      await sharp(inputPath)
        .resize(320, 240, { fit: 'cover', position: 'center' })
        .webp({ quality: 75 })
        .toFile(outputPath)
    } else {
      // ImageMagick 降级方案
      execSync(
        `convert "${inputPath}" -resize 320x240^ -gravity center -extent 320x240 -quality 75 "${outputPath}"`,
        { stdio: 'pipe' }
      )
    }
    count++
    if (count % 20 === 0) {
      console.log(`[thumbs] 进度: ${count}/${files.length}`)
    }
  } catch (err: any) {
    console.error(`[thumbs] 处理 ${file} 失败: ${err.message}`)
  }
}

console.log(`[thumbs] 完成: ${count} 张新生成, ${skipped} 张已跳过`)
console.log(`[thumbs] 输出目录: ${thumbsDir}`)

// 显示缩略图大小对比
if (count > 0) {
  const sample = files[0]
  const origSize = fs.statSync(path.join(imagesDir, sample)).size
  const thumbSize = fs.statSync(path.join(thumbsDir, sample.replace('.jpg', '.webp'))).size
  console.log(
    `[thumbs] 示例压缩比: ${sample} ${(origSize / 1024).toFixed(0)}KB → ${(thumbSize / 1024).toFixed(0)}KB (${((1 - thumbSize / origSize) * 100).toFixed(0)}% 减小)`
  )
}
