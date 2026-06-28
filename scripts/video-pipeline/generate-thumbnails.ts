/**
 * 为所有 JPG 原图生成 WebP 缩略图 (thumbs/320px) 和中图 (mediums/640px)
 * 用法: npx tsx generate-thumbnails.ts
 */
import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const IMAGES_DIR = path.resolve(__dirname, '..', '..', 'server', 'generated_images')
const THUMBS_DIR = path.join(IMAGES_DIR, 'thumbs')
const MEDIUMS_DIR = path.join(IMAGES_DIR, 'mediums')

// 确保目录存在
fs.mkdirSync(THUMBS_DIR, { recursive: true })
fs.mkdirSync(MEDIUMS_DIR, { recursive: true })

async function main() {
  const files = fs.readdirSync(IMAGES_DIR).filter(f => f.endsWith('.jpg') || f.endsWith('.jpeg'))
  console.log(`找到 ${files.length} 张 JPG 原图\n`)

  let thumbsOk = 0, thumbsSkip = 0, thumbsFail = 0
  let mediumsOk = 0, mediumsSkip = 0, mediumsFail = 0
  let processed = 0

  for (const file of files) {
    const code = path.parse(file).name
    const srcPath = path.join(IMAGES_DIR, file)
    const thumbPath = path.join(THUMBS_DIR, `${code}.webp`)
    const mediumPath = path.join(MEDIUMS_DIR, `${code}.webp`)

    // 缩略图 320px
    if (fs.existsSync(thumbPath)) {
      thumbsSkip++
    } else {
      try {
        await sharp(srcPath)
          .resize(320, 427, { fit: 'cover', position: 'center' })
          .webp({ quality: 80 })
          .toFile(thumbPath)
        thumbsOk++
      } catch (e) {
        console.error(`  ✗ thumb ${code}: ${e}`)
        thumbsFail++
      }
    }

    // 中图 640px
    if (fs.existsSync(mediumPath)) {
      mediumsSkip++
    } else {
      try {
        await sharp(srcPath)
          .resize(640, 853, { fit: 'cover', position: 'center' })
          .webp({ quality: 85 })
          .toFile(mediumPath)
        mediumsOk++
      } catch (e) {
        console.error(`  ✗ medium ${code}: ${e}`)
        mediumsFail++
      }
    }

    processed++
    if (processed % 20 === 0) {
      console.log(`  进度: ${processed}/${files.length} 张`)
    }
  }

  console.log(`\n完成:`)
  console.log(`  thumbs:  ${thumbsOk} 生成, ${thumbsSkip} 跳过, ${thumbsFail} 失败`)
  console.log(`  mediums: ${mediumsOk} 生成, ${mediumsSkip} 跳过, ${mediumsFail} 失败`)
}

main().catch(console.error)
