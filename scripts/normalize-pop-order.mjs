/**
 * 让流行角色在结果页排第 2 位。
 *
 * 结果页的展示顺序 = 主人物（恒第 1）+ 名单里除主人物外的其余人（按数组顺序）。
 * 所以「角色排在主人物之后」在数据里要表达成：角色紧跟主人物、且位于所有非主人物之前。
 * 否则会出现角色被挤到第 3、第 4 位的情况（例如 IBCJ 的梅长苏）。
 *
 * 用法：npx tsx scripts/normalize-pop-order.mjs [--dry]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FILE = resolve(ROOT, 'server/src/content/types.ts')
const STORIES = resolve(ROOT, 'server/src/content/celebrity-stories.ts')
const POP = JSON.parse(readFileSync(resolve(ROOT, 'scripts/pop-culture-reps.json'), 'utf8'))
const DRY = process.argv.includes('--dry')

const blockOf = (src, marker) => {
  const i = src.indexOf(marker)
  const s = src.indexOf('{', i)
  let d = 0
  for (let j = s; j < src.length; j++) {
    if (src[j] === '{') d++
    else if (src[j] === '}') { d--; if (!d) return src.slice(s + 1, j) }
  }
  return ''
}

// 每个型的主人物
const body = blockOf(readFileSync(STORIES, 'utf8'), 'FEATURED_PROFILES')
const marks = [...body.matchAll(/([A-Z]{4}):\s*\{/g)].map((m) => ({ code: m[1], at: m.index }))
const mainOf = {}
for (let k = 0; k < marks.length; k++) {
  const seg = body.slice(marks[k].at, k + 1 < marks.length ? marks[k + 1].at : body.length)
  const n = seg.match(/name:\s*'((?:[^'\\]|\\.)*)'/)
  if (n) mainOf[marks[k].code] = n[1]
}

const src = readFileSync(FILE, 'utf8')
const lines = src.split('\n')
const fixed = []

for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(/^(\s*)([A-Z]{4}): \[(.*)\],\s*$/)
  if (!m) continue
  const [, pad, code, inner] = m
  const list = [...inner.matchAll(/'([^']*)'/g)].map((x) => x[1])
  const pops = list.filter((n) => POP[n])
  if (pops.length !== 1) continue // 0 个不用管；2 个及以上人工决定
  const pop = pops[0]
  const main = mainOf[code]
  if (pop === main) continue

  const rest = list.filter((n) => n !== pop && n !== main)
  const next = main && list.includes(main) ? [main, pop, ...rest] : [pop, ...rest]
  if (next.join() === list.join()) continue

  lines[i] = `${pad}${code}: [${next.map((n) => `'${n}'`).join(', ')}],`
  fixed.push({ code, before: list, after: next })
}

console.log(`调整 ${fixed.length} 个型的顺序`)
for (const f of fixed) {
  console.log(`  ${f.code}  ${f.before.join('、')}`)
  console.log(`      →  ${f.after.join('、')}`)
}
if (!DRY) {
  writeFileSync(FILE, lines.join('\n'), 'utf8')
  console.log(`已写入 ${FILE}`)
} else console.log('（--dry，未写盘）')
