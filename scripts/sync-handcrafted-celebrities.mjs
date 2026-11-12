/**
 * 把 handCraftedTypes 里手写的 celebrities 数组改成与 CELEBRITY_MAP 完全一致
 *
 * 背景：16 个传统型的内容是手工维护的（handCraftedTypes），它们各自带一份
 * `celebrities` 副本；而 81 型的其余 65 个型由 CELEBRITY_MAP 生成。
 * 副本曾经漂移（实测 16 个里 13 个对不上），而 seed 又把副本写进数据库，
 * 于是线上 16 型的代表人物会是旧名单。
 *
 * 用法：npx tsx scripts/sync-handcrafted-celebrities.mjs [--dry]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FILE = resolve(ROOT, 'server/src/content/types.ts')
const DRY = process.argv.includes('--dry')

const src = readFileSync(FILE, 'utf8')

/* 1. 解析 CELEBRITY_MAP */
const mapAt = src.indexOf('const CELEBRITY_MAP')
const brace = src.indexOf('{', mapAt)
let depth = 0
let close = brace
for (let j = brace; j < src.length; j++) {
  if (src[j] === '{') depth++
  else if (src[j] === '}') { depth--; if (!depth) { close = j; break } }
}
const map = {}
for (const line of src.slice(brace + 1, close).split('\n')) {
  const m = line.match(/^\s*([A-Z]{4}):\s*\[(.*)\]/)
  if (m) map[m[1]] = [...m[2].matchAll(/'([^']*)'/g)].map((x) => x[1])
}

/* 2. 只改 handCraftedTypes 块内、紧跟 code: 'XXXX' 的 celebrities 行 */
const hcAt = src.indexOf('export const handCraftedTypes')
if (hcAt < 0) throw new Error('找不到 handCraftedTypes')

const head = src.slice(0, hcAt)
const tail = src.slice(hcAt)
const lines = tail.split('\n')

let current = null
let touched = 0
const log = []
for (let i = 0; i < lines.length; i++) {
  const codeM = lines[i].match(/^\s*code: '([A-Z]{4})'/)
  if (codeM) { current = codeM[1]; continue }
  const cM = lines[i].match(/^(\s*)celebrities: \[(.*)\],\s*$/)
  if (!cM || !current || !map[current]) continue
  const before = [...cM[2].matchAll(/'([^']*)'/g)].map((x) => x[1])
  const after = map[current]
  lines[i] = `${cM[1]}celebrities: [${after.map((n) => `'${n}'`).join(', ')}],`
  touched++
  if (before.join() !== after.join()) log.push({ code: current, before, after })
  current = null
}

console.log(`handCraftedTypes 内 celebrities 行：改写 ${touched} 行 · 内容有变化 ${log.length} 处`)
for (const r of log) console.log(`  ${r.code}  ${r.before.join('、')}  →  ${r.after.join('、')}`)

if (!DRY && touched) {
  writeFileSync(FILE, head + lines.join('\n'), 'utf8')
  console.log(`已写入 ${FILE}`)
} else if (DRY) {
  console.log('（--dry，未写盘）')
}
