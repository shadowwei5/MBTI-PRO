/**
 * 把「15–35 岁一眼认出的流行角色」加进 81 型代表人物。
 *
 * 规则（用户 2026-11-12 定）：
 *   ① 只在「明显对应」的类型加，不硬凑；
 *   ② 每个型结果页固定展示 4 人，所以加一个就要换掉该型里最弱的一位；
 *   ③ 新角色插在第 2 位（主人物固定第 1 位），结果页上紧跟主人物出现。
 *
 * 幂等：已经加过就跳过；要换掉的人不在名单里会报错而不是静默失败。
 *
 * 用法：npx tsx scripts/apply-pop-reps.mjs [--dry]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FILE = resolve(ROOT, 'server/src/content/types.ts')
const DRY = process.argv.includes('--dry')

/** code · 换掉谁 · 加谁 · 为什么是这一型 */
const PLAN = [
  ['ENFP', '汪曾祺', '漩涡鸣人', 'E 外放、N 要改变整个忍者体系、F 靠羁绊驱动、P 从不做计划'],
  ['ENTD', '杰克·韦尔奇', '钢铁侠', '外向张扬、直觉造未来、思考决策、动态应变（J/P 落在 D）'],
  ['INFJ', '陀思妥耶夫斯基', '宇智波鼬', '内向独行、直觉看穿全局、情感深藏、判断式长线布局'],
  ['ESFP', '埃尔顿·约翰', '蒙奇·D·路飞', '外向、实感当下、情感优先、感知随性'],
  ['ENTJ', '撒切尔夫人', '江户川柯南', '指挥型推理、判断果决（E/I 是这一型的争议点）'],
  ['INTP', '庄子', 'L', '内向、直觉推演、纯逻辑、感知式不设流程'],
  ['ESTJ', '伊丽莎白二世', '赫敏·格兰杰', '外向组织、实感细节、思考判分、判断守规'],
  ['ISTP', '原研哉', '流川枫', '内向寡言、实感身体技术、思考冷静、感知随性'],
  ['ISFJ', '林巧稚', '哆啦A梦', '内向守护、实感解决眼前问题、情感照顾、判断有章法'],
  ['ESFJ', '雷锋', '灶门炭治郎', '外向连接他人、实感务实、情感共情、判断守礼尽责'],
  ['ENTP', '马克·吐温', '五条悟', '外向挑衅、直觉跳跃、思考戏谑、感知不守规矩'],
  ['ISTJ', '曾参', '利威尔·阿克曼', '内向寡言、实感务实、思考决断、判断重纪律'],
]

const src = readFileSync(FILE, 'utf8')
const lines = src.split('\n')
const applied = []
const skipped = []

for (const [code, drop, add, why] of PLAN) {
  const idx = lines.findIndex((l) => l.startsWith(`  ${code}: [`))
  if (idx < 0) throw new Error(`找不到 ${code} 的名单行`)

  const list = [...lines[idx].matchAll(/'([^']*)'/g)].map((m) => m[1])
  if (list.includes(add)) { skipped.push(`${code}:${add}（已存在）`); continue }
  if (!list.includes(drop)) throw new Error(`${code} 名单里没有「${drop}」，实际是：${list.join('、')}`)

  const next = list.filter((n) => n !== drop)
  next.splice(1, 0, add)
  lines[idx] = `  ${code}: [${next.map((n) => `'${n}'`).join(', ')}],`
  applied.push({ code, drop, add, before: list, after: next, why })
}

console.log(`应用 ${applied.length} 条 · 跳过 ${skipped.length} 条`)
for (const a of applied) {
  console.log(`  ${a.code}  ${a.before.join('、')}`)
  console.log(`      →  ${a.after.join('、')}   （${a.why}）`)
}
for (const s of skipped) console.log('  跳过', s)

if (DRY) {
  console.log('（--dry，未写盘）')
} else {
  writeFileSync(FILE, lines.join('\n'), 'utf8')
  console.log(`已写入 ${FILE}`)
}
