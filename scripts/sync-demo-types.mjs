/**
 * 把 server/src/content 里的代表人物数据同步到前端静态样本
 *
 * client/public/demo/types.json 是「演示模式」（VITE_DEMO_MODE=1）下前端读取的静态 81 型数据。
 * 它曾经是一份手抄副本，代表人物的 celebrities / celebrityStories 两个字段很容易过期。
 * 本脚本只重写这两个字段，其余字段（summary / overview / strengths …）原样保留。
 *
 * 用法：npx tsx scripts/sync-demo-types.mjs [--dry]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getCelebrityProfiles } from '../server/src/content/types.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FILE = resolve(ROOT, 'client/public/demo/types.json')
const DRY = process.argv.includes('--dry')

const types = JSON.parse(readFileSync(FILE, 'utf8'))
if (!Array.isArray(types) || types.length !== 81) {
  throw new Error(`demo/types.json 结构异常：期望 81 型数组，实际 ${Array.isArray(types) ? types.length : typeof types}`)
}

const report = { total: 0, celebs: 0, stories: 0, missing: [] }

for (const t of types) {
  report.total++
  const profiles = getCelebrityProfiles(t.code)
  const names = profiles.map((p) => p.name)
  if (!names.length) report.missing.push(t.code)

  const beforeC = JSON.stringify(t.celebrities || [])
  const beforeS = JSON.stringify(t.celebrityStories || [])

  t.celebrities = names
  t.celebrityStories = profiles

  if (JSON.stringify(t.celebrities) !== beforeC) report.celebs++
  if (JSON.stringify(t.celebrityStories) !== beforeS) report.stories++
}

console.log(`扫描 ${report.total} 型`)
console.log(`  celebrities 有变化：${report.celebs}`)
console.log(`  celebrityStories 有变化：${report.stories}`)
if (report.missing.length) console.log(`  缺代表人物：${report.missing.join(', ')}`)

if (DRY) {
  console.log('（--dry，未写盘）')
} else {
  writeFileSync(FILE, JSON.stringify(types), 'utf8')
  console.log(`已写入 ${FILE}`)
}
