// 统一16型新图背景 — 提取旧图暗部颜色 → 新图叠加统一暗色遮罩
import sharp from 'sharp'
import { readdirSync, existsSync, mkdirSync, copyFileSync, renameSync } from 'node:fs'
import { join } from 'node:path'

const IMG_DIR = join(import.meta.dirname, '..', '..', 'server', 'generated_images')
const BACKUP_DIR = join(IMG_DIR, '_before_v3')
const TYPES_16 = ['INTP','INTJ','ENTP','ENTJ','INFP','INFJ','ENFP','ENFJ','ISTJ','ISFJ','ESTJ','ESFJ','ISTP','ISFP','ESTP','ESFP']

// 从旧图中抽样分析暗部颜色
async function sampleOldBg(): Promise<string> {
  // 取几个旧图（非16型的图）的暗部平均色
  const samples = ['ANTP', 'IBCD', 'EBFP', 'ASCD', 'INCD'] // 确认为旧图的非16型
  let totalR = 0, totalG = 0, totalB = 0, count = 0

  for (const code of samples) {
    const path = join(IMG_DIR, `${code}.jpg`)
    if (!existsSync(path)) continue
    try {
      const { data, info } = await sharp(path).resize(200, 200).raw().toBuffer({ resolveWithObject: true })
      // 采样边缘像素（暗部=背景）
      for (let y = 0; y < 20; y++) {
        for (let x = 0; x < info.width; x++) {
          const i = (y * info.width + x) * 3
          if (data[i] < 100 && data[i+1] < 100 && data[i+2] < 100) { // 暗像素
            totalR += data[i]; totalG += data[i+1]; totalB += data[i+2]; count++
          }
        }
      }
    } catch {}
  }
  if (count === 0) return '#1a1a2e' // 默认深海军蓝
  const r = Math.round(totalR / count).toString(16).padStart(2, '0')
  const g = Math.round(totalG / count).toString(16).padStart(2, '0')
  const b = Math.round(totalB / count).toString(16).padStart(2, '0')
  return `#${r}${g}${b}`
}

async function main() {
  if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true })

  console.log('🔍 分析旧图背景色...')
  const oldBg = await sampleOldBg()
  console.log(`   旧图暗部平均色: ${oldBg}`)

  // 创建统一暗色遮罩（半透明矩形）
  const overlay = await sharp({
    create: { width: 2048, height: 2048, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  }).composite([{
    input: Buffer.from(`<svg><rect width="2048" height="2048" fill="${oldBg}" opacity="0.3"/></svg>`),
    blend: 'over',
  }]).png().toBuffer()

  console.log(`\n🎨 处理 16 型新图...`)
  for (const code of TYPES_16) {
    const srcPath = join(IMG_DIR, `${code}.jpg`)
    if (!existsSync(srcPath)) { console.log(`  ⚠ ${code}: 不存在`); continue }

    // 备份
    const bakPath = join(BACKUP_DIR, `${code}.jpg`)
    if (!existsSync(bakPath)) copyFileSync(srcPath, bakPath)

    // 处理：降低饱和度 + 叠加暗色遮罩
    const tmpPath = join(IMG_DIR, `_fix_${code}.jpg`)
    try {
      await sharp(srcPath)
        .modulate({ saturation: 0.82, brightness: 0.94 })
        .composite([{ input: overlay, blend: 'multiply' }])
        .jpeg({ quality: 92 })
        .toFile(tmpPath)
      renameSync(tmpPath, srcPath)
      console.log(`  ✅ ${code}`)
    } catch (e: any) {
      console.log(`  ❌ ${code}: ${e.message}`)
    }
  }

  console.log(`\n✅ 完成! 备份: ${BACKUP_DIR}/`)
}

main().catch(e => { console.error(e); process.exit(1) })
