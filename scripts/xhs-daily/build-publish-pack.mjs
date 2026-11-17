/**
 * 生成「单日发布包」：把某一天的成品图（7 张）+ 可复制文案打包到一个文件夹，
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
  `《${note.title}》· 发布包`,
  '',
  '════ 零、发布前必查（2026-11-18 更新）════',
  'A. 店铺已开通（Shadow奇思妙想的店 / 申请 ID 36008895）；商品卡之前几篇都挂好了，本篇同样挂上。',
  'B. 五篇实测（浏览/评论/点赞/收藏）：Day1=77/0/5/0、Day2=62/0/2/0、Day3=22/1/2/1、',
  '   Day4=13/1/1/1、Day5=2/1/0/0（发 1 小时）。',
  '   → 关键发现：点赞率一直 6.5%-12.5%（正常偏上），说明点进来的人认可；',
  '     问题在「有多少人看到」。Day1/Day2 破 60 的共同点 = 标题在跟读者说话。',
  'C. 时段假设已证伪（Day4 晚高峰 20:27 发，浏览 13 最低）。发布时间保持 20:30-21:30 即可，',
  '   但别再把它当变量。',
  'D. 【本篇是答题型样板】与前 5 篇的根本区别：读者在图上当场做完 3 道题，',
  '   P5 直接给出「你的字母 → 属于哪一档」，不用跳转就知道结果。角色降为 P6 锚点。',
  'E. 本篇验收：浏览 ≥30？评论区有没有真实的字母回复（不是只有作者置顶）？',
  '   → 若评论出现真人的字母串，说明答题型结构成立，之后按 5:2:2 配比铺开。',
  '',
  '════ 一、发布步骤（5 步）════',
  '1. 小红书 App → 底部「+」→ 图文 → 按 01→07 顺序选这 7 张图',
  '2. 下一步 → 粘贴标题 → 粘贴正文 → 填 7 个话题',
  '3. 【商品卡已挂】手机端发布时确认一下商品卡在（之前几篇都挂了，别漏）',
  '4. 位置不填（填了会缩小推荐范围）→ 【务必 20:30–21:30 发布】（见第零节 C）',
  '5. 发布后 10 分钟内：发下面那条作者置顶评论，并回复前 5 条真实评论',
  '',
  '════ 二、标题（≤20 字，直接粘贴）════',
  note.title,
  '',
  '════ 三、正文（直接粘贴，含固定免责尾句）════',
  bodyText,
  '',
  '════ 四、话题标签（7 个，填进标签栏）════',
  note.tags,
  '',
  '════ 五、作者置顶评论（发布后 10 分钟内发）════',
  note.pinned,
  '',
  '════ 六、图片顺序（7 张；第 1 张就是封面，第 2 张是能当场做的题）════',
  pngs.map((f, i) => `P${i + 1}  ${f}`).join('\n'),
  '',
  '════ 七、免责（正文尾已含，勿删）════',
  DISCLAIMER,
  '',
].join('\n')

const TXT_NAME = '00-发布包（先看这个）.txt'
writeFileSync(resolve(outDir, TXT_NAME), txt, 'utf8')

console.log(`已生成发布包：${outDir}`)
console.log(`  图片 ${pngs.length} 张：${pngs[0]} … ${pngs[pngs.length - 1]}`)
console.log(`  ${TXT_NAME}  ${txt.replace(/\s/g, '').length} 字`)
console.log(`  标题「${note.title}」${note.title.length} 字 · 正文 ${bodyText.replace(/\s/g, '').length} 字`)
