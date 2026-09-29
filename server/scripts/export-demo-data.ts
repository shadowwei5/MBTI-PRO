/**
 * 导出前端静态演示站所需的数据
 *
 * 用途：MBTI-PRO 服务器停止后，用纯静态托管（Vercel/Netlify/GitHub Pages）
 * 继续提供可访问的演示站点。本脚本把题库与 81 型内容导出为 JSON，
 * 供客户端在 VITE_DEMO_MODE=1 时直接读取，无需后端。
 *
 * 用法：cd server && ./node_modules/.bin/tsx scripts/export-demo-data.ts
 * 输出：../client/public/demo/questions.json
 *       ../client/public/demo/types.json
 *       ../client/public/demo/meta.json
 *       ../client/public/demo/images/*.webp   （81 张类型插画）
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildTypeContent, generateAllTypeCodes } from '../src/content/types.js'
import { DIMENSION_MODULES } from '../src/content/dimension-modules.js'
import { questions } from '../src/seed.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SERVER_DIR = path.resolve(__dirname, '..')
const OUT_DIR = path.resolve(SERVER_DIR, '..', 'client', 'public', 'demo')
/** 图片来源：mediums 是已压过的 webp（约 18KB/张），适合静态托管 */
const SRC_IMG_DIR = path.join(SERVER_DIR, 'generated_images', 'mediums')

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })

  // ── 题库 ────────────────────────────────────────────────
  const qs = questions.map((q) => ({
    id: q.id,
    text: q.text,
    textLeft: q.textLeft ?? null,
    textRight: q.textRight ?? null,
    dimension: q.dimension,
    type: q.type,
    options: q.options,
    // 演示模式下的评分在客户端完成，客观题需要正确答案
    correctAnswer: q.correctAnswer ?? null,
  }))
  fs.writeFileSync(
    path.join(OUT_DIR, 'questions.json'),
    JSON.stringify(qs, null, 0),
    'utf8',
  )

  // ── 81 型内容 ───────────────────────────────────────────
  const codes = generateAllTypeCodes()
  const types = codes.map((code) => {
    const t = buildTypeContent(code) as Record<string, unknown>
    return {
      code,
      name: t.name,
      isTraditional: t.isTraditional,
      summary: t.summary ?? null,
      overview: t.overview,
      strengths: t.strengths,
      growthAreas: t.growthAreas,
      careers: t.careers,
      suitableFields: t.suitableFields,
      population: t.population ?? null,
      celebrities: t.celebrities ?? null,
      eiModule: DIMENSION_MODULES[code]?.eiModule ?? null,
      snModule: DIMENSION_MODULES[code]?.snModule ?? null,
      tfModule: DIMENSION_MODULES[code]?.tfModule ?? null,
      pjModule: DIMENSION_MODULES[code]?.pjModule ?? null,
      imageUrl: `/demo/images/${code}.webp`,
    }
  })
  fs.writeFileSync(
    path.join(OUT_DIR, 'types.json'),
    JSON.stringify(types, null, 0),
    'utf8',
  )

  // ── 元信息 ──────────────────────────────────────────────
  const dimCount: Record<string, number> = {}
  const typeCount: Record<string, number> = {}
  for (const q of qs) {
    dimCount[q.dimension] = (dimCount[q.dimension] ?? 0) + 1
    typeCount[q.type] = (typeCount[q.type] ?? 0) + 1
  }
  fs.writeFileSync(
    path.join(OUT_DIR, 'meta.json'),
    JSON.stringify(
      {
        demo: true,
        questionCount: qs.length,
        typeCount: types.length,
        dimensionCounts: dimCount,
        questionTypeCounts: typeCount,
      },
      null,
      2,
    ),
    'utf8',
  )

  // ── 类型插画（只取正式 81 张，跳过 *_backup / *_bak_skin 等过程变体）──
  const imgOutDir = path.join(OUT_DIR, 'images')
  fs.mkdirSync(imgOutDir, { recursive: true })
  const wanted = new Set(codes)
  let copied = 0
  let skipped = 0
  if (fs.existsSync(SRC_IMG_DIR)) {
    for (const f of fs.readdirSync(SRC_IMG_DIR)) {
      if (!f.endsWith('.webp')) continue
      const code = path.basename(f, '.webp')
      if (!wanted.has(code)) {
        skipped++
        continue
      }
      fs.copyFileSync(path.join(SRC_IMG_DIR, f), path.join(imgOutDir, f))
      copied++
    }
  }

  const size = (f: string) =>
    (fs.statSync(path.join(OUT_DIR, f)).size / 1024).toFixed(1) + ' KB'

  console.log('导出完成 →', OUT_DIR)
  console.log(`  questions.json  ${qs.length} 题  ${size('questions.json')}`)
  console.log(`  types.json      ${types.length} 型  ${size('types.json')}`)
  console.log(`  meta.json                        ${size('meta.json')}`)
  console.log(`  images/         ${copied} 张（跳过 ${skipped} 个过程变体）`)
  console.log('  维度分布:', dimCount)
  console.log('  题型分布:', typeCount)

  if (copied !== codes.length) {
    const missing = codes.filter((c) => !fs.existsSync(path.join(imgOutDir, `${c}.webp`)))
    console.warn(`\n⚠️ 有 ${missing.length} 个类型缺图：${missing.join(', ')}`)
  }
}

main()
