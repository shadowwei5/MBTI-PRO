/**
 * 第二批代表人物调整（2026-11-12 23:59）：
 *   A. 补三个用户确认「明显对应」的角色；
 *   B. 换掉近代国内政治人物（避免借用名义的额外麻烦）。
 *
 * 规则同第一批：结果页固定展示 4 人，加人前先确认该型还剩几个位；
 * 插入位置固定在第 2 位（主人物第 1 位）。
 *
 * 用法：npx tsx scripts/apply-pop-reps-2.mjs [--dry]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FILE = resolve(ROOT, 'server/src/content/types.ts')
const DRY = process.argv.includes('--dry')

/** 换人：code · 换掉 · 换成 · 理由 */
const REPLACE = [
  ['INFP', '卢梭', '阿尔敏·阿诺德', 'I 内向读书、N 看长远、F 不愿牺牲任何人、P 临场应变；换掉名字对 15–35 最不响的卢梭'],
  ['ISFP', '张大千', '我妻善逸', 'I 回避冲突、S 身体技术（雷之呼吸）、F 情感外露、P 随心；留齐白石代表中国画家'],
  ['ESFJ', '周恩来', '安娜', 'E 主动社交、S 具体务实、F 情感驱动、J 行动果决；换掉近代政治人物'],
  ['EBFD', '宋庆龄', '何炅', 'E 场上核心、B 两种都像、F 照顾他人感受、D 灵活应变；换掉近代政治人物'],
  ['EBFD', '何香凝', '贾玲', '同上；换掉近代政治人物'],
]

/** 纯新增（该型还有空位）：code · 加谁 · 理由 */
const ADD = [
  ['ANTJ', '谢尔顿·库珀', 'E/I 公认争议 → 平衡 A；N 理论、T 逻辑、J 刻板流程。这个「争议」本身就是中间档的证据'],
]

const src = readFileSync(FILE, 'utf8')
const lines = src.split('\n')
const applied = []
const skipped = []

const findLine = (code) => {
  const idx = lines.findIndex((l) => l.trimStart().startsWith(`${code}: [`))
  if (idx < 0) throw new Error(`找不到 ${code} 的名单行`)
  return idx
}
const parse = (line) => [...line.matchAll(/'([^']*)'/g)].map((m) => m[1])
const write = (idx, code, list) => {
  lines[idx] = `  ${code}: [${list.map((n) => `'${n}'`).join(', ')}],`
}

for (const [code, drop, add, why] of REPLACE) {
  const idx = findLine(code)
  const list = parse(lines[idx])
  if (list.includes(add)) { skipped.push(`${code}:${add}（已存在）`); continue }
  if (!list.includes(drop)) throw new Error(`${code} 名单里没有「${drop}」，实际是：${list.join('、')}`)
  const next = list.map((n) => (n === drop ? add : n))
  write(idx, code, next)
  applied.push({ code, kind: '换', drop, add, before: list, after: next, why })
}

for (const [code, add, why] of ADD) {
  const idx = findLine(code)
  const list = parse(lines[idx])
  if (list.includes(add)) { skipped.push(`${code}:${add}（已存在）`); continue }
  if (list.length >= 4) throw new Error(`${code} 已有 ${list.length} 位，先决定换掉谁`)
  const next = [...list]
  next.splice(1, 0, add)
  write(idx, code, next)
  applied.push({ code, kind: '增', drop: '', add, before: list, after: next, why })
}

console.log(`应用 ${applied.length} 条 · 跳过 ${skipped.length} 条`)
for (const a of applied) {
  console.log(`  [${a.kind}] ${a.code}  ${a.before.join('、')}`)
  console.log(`        →  ${a.after.join('、')}`)
  console.log(`        ${a.why}`)
}
for (const s of skipped) console.log('  跳过', s)

if (DRY) console.log('（--dry，未写盘）')
else {
  writeFileSync(FILE, lines.join('\n'), 'utf8')
  console.log(`已写入 ${FILE}`)
}
