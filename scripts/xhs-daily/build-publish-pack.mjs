/**
 * 生成「单日发布包」：把某一天的 9 张成品图 + 可复制文案打包到一个文件夹，
 * 便于一次性传到手机、在小红书 App 里按顺序上传。
 *
 * 用法：
 *   node scripts/xhs-daily/build-publish-pack.mjs --note day1 --date 2026-11-13
 *   node scripts/xhs-daily/build-publish-pack.mjs --note day2 --date 2026-11-14 --dir docs/xhs-daily/week1/day2-发布包
 *
 * 产物：
 *   docs/xhs-daily/week1/<note>-发布包-<date>/
 *     01.png … 09.png
 *     文案.txt      （标题 / 正文 / 话题 / 首评，按小红书发布页字段顺序排列）
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { NOTES, DISCLAIMER } from './notes-data.mjs'

const ROOT = resolve(import.meta.dirname, '../..')
// 支持 `--note day1` 与 `--note=day1` 两种写法
const rawArgs = process.argv.slice(2)
const args = {}
for (let i = 0; i < rawArgs.length; i++) {
  const a = rawArgs[i]
  if (!a.startsWith('--')) continue
  const eq = a.indexOf('=')
  if (eq > -1) {
    args[a.slice(2, eq)] = a.slice(eq + 1)
  } else {
    const key = a.slice(2)
    const next = rawArgs[i + 1]
    if (next && !next.startsWith('--')) {
      args[key] = next
      i++
    } else {
      args[key] = true
    }
  }
}

const noteKey = String(args.note || 'day1')
const date = String(args.date || new Date().toISOString().slice(0, 10))
const note = NOTES.find((n) => n.key === noteKey)
if (!note) {
  console.error(`找不到 ${noteKey}，可用：${NOTES.map((n) => n.key).join(', ')}`)
  process.exit(2)
}

const srcDir = resolve(ROOT, `docs/xhs-daily/week1/${noteKey}`)
const outDir = resolve(ROOT, String(args.dir || `docs/xhs-daily/week1/${noteKey}-发布包-${date}`))
if (!existsSync(srcDir)) {
  console.error(`缺少图片目录：${srcDir}，先跑 node scripts/xhs-daily/render-cards.mjs --note ${noteKey}`)
  process.exit(2)
}

mkdirSync(outDir, { recursive: true })

const pngs = readdirSync(srcDir).filter((f) => f.endsWith('.png')).sort()
for (const f of pngs) copyFileSync(resolve(srcDir, f), resolve(outDir, f))

// 首评：正文里的互动问句 + 自答，保持与 P9 一致
const bodyText = note.body.join('\n\n')
const txt = [
  `# ${note.title}`,
  '',
  '— 标题（≤20 字，直接粘贴）—',
  note.title,
  '',
  '— 正文（直接粘贴，含固定免责尾句）—',
  bodyText,
  '',
  '— 话题标签（7 个，填进标签栏）—',
  note.tags,
  '',
  '— 作者置顶评论（发布后 10 分钟内发）—',
  note.pinned,
  '',
  '— 图片顺序（9 张，按文件名顺序上传；第 1 张为封面）—',
  pngs.map((f, i) => `P${i + 1}  ${f}`).join('\n'),
  '',
  `— 免责（正文尾已含，勿删）—`,
  DISCLAIMER,
  '',
].join('\n')

writeFileSync(resolve(outDir, '文案.txt'), txt, 'utf8')

console.log(`已生成发布包：${outDir}`)
console.log(`  图片 ${pngs.length} 张：${pngs[0]} … ${pngs[pngs.length - 1]}`)
console.log(`  文案.txt  ${txt.replace(/\s/g, '').length} 字`)
console.log(`  标题「${note.title}」${note.title.length} 字 · 正文 ${bodyText.replace(/\s/g, '').length} 字`)
