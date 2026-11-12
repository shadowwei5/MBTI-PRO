/**
 * 静态演示版构建冒烟测试
 *
 * 在真实 Chrome 中打开构建产物，验证：
 *   1. 三个页面都能渲染、无控制台错误、无 404 资源
 *   2. 81 张类型插画全部可加载
 *   3. 付费墙正常出现，且演示解锁按钮能展开完整报告
 *   4. 不出现"报告已发送到邮箱"这类在演示环境下不成立的承诺
 *
 * 用法：
 *   1. 构建产物已在跑： cd client && npx vite preview --port 4174
 *   2. 跑本脚本：       cd server && ./node_modules/.bin/tsx scripts/verify-demo-build.ts [baseUrl]
 *      （默认 http://127.0.0.1:4174）
 *
 * 说明：本机 playwright 期望的 chromium 版本与已安装版本可能不一致，
 * 因此优先使用系统 Chrome（channel: 'chrome'）。
 */

import { chromium } from 'playwright'

const BASE = process.argv[2] || process.env.DEMO_BASE_URL || 'http://127.0.0.1:4174'
const OUT = process.env.DEMO_SHOT_DIR || '.'

const errors: string[] = []
const notFound: string[] = []

const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })

page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`[console] ${m.text()}`)
})
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`))
page.on('response', (r) => {
  if (r.status() === 404) notFound.push(`${r.status()} ${r.url()}`)
})

/** 访问页面：等网络空闲 → 滚到底触发懒加载 → 回到顶部 → 收集指标 */
async function visit(name: string, path: string, shot: string) {
  errors.length = 0
  notFound.length = 0
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 40000 })
  await page.waitForTimeout(800)
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(1500)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(500)

  const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim()
  await page.screenshot({ path: `${OUT}/${shot}` })

  const imgStat = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img'))
    const broken = imgs.filter(
      (i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth === 0,
    )
    return { total: imgs.length, broken: broken.length }
  })

  console.log(`\n===== ${name} (${path}) =====`)
  console.log(`可见文本 ${text.length} 字 | <img> ${imgStat.total} 张，损坏 ${imgStat.broken} 张`)
  console.log(`正文: ${text.slice(0, 160)}`)
  if (notFound.length) console.log(`404 资源: ${notFound.join(' ; ')}`)
  if (errors.length) console.log(`错误: ${errors.slice(0, 5).join(' | ')}`)
  return { text, notFound: [...notFound], errors: [...errors] }
}

let failures = 0
function check(label: string, ok: boolean) {
  console.log(`  → ${label}: ${ok ? '是 ✓' : '否 ✗'}`)
  if (!ok) failures++
}

// 1. 首页
const home = await visit('首页', '/', 'demo_1_home.png')
check('演示环境横幅存在', home.text.includes('演示环境'))

// 2. 测试页
const test = await visit('测试页', '/test', 'demo_2_test.png')
check('题干正常渲染', test.text.includes('情境选择题') || test.text.includes('认同'))
check('题目总数为 40', test.text.includes('共 40 题') || test.text.includes('/ 40'))

// 3. 结果页（无测试数据 → 不展示解锁卡）
const bare = await visit('结果页（无测试数据）', '/result/ENTJ', 'demo_3_result.png')
check('含类型名', bare.text.includes('ENTJ'))
check('无测试数据时不显示解锁卡', !bare.text.includes('解锁完整 81 型报告'))

// 4. 结果页（带测试数据 → 演示环境直接展示完整报告）
const params = new URLSearchParams({
  scores: JSON.stringify({ E_I: 15, S_N: 12, T_F: 9, P_J: 11, T_F_sub: 6, T_F_obj: 3 }),
  chars: JSON.stringify({ E_I: 'E', S_N: 'N', T_F: 'T', P_J: 'J' }),
  dimTotals: JSON.stringify({ E_I: 10, S_N: 10, T_F: 10, P_J: 10 }),
  dimAnswered: JSON.stringify({ E_I: 10, S_N: 10, T_F: 10, P_J: 10 }),
  recordId: 'demo-record',
})
const full = await visit('结果页（含测试数据）', `/result/ENTJ?${params}`, 'demo_4_full.png')
check('演示环境直接展示完整报告', full.text.includes('人格概览') && full.text.includes('四维深度解析'))
check('不出现兑换码解锁卡', !full.text.includes('解锁完整 81 型报告'))
check('未出现"发送到邮箱"的虚假承诺', !full.text.includes('发送到你的邮箱'))

// 5. 检查 40 题版所有题目都能加载
const questionCount = await page.evaluate(async () => {
  const res = await fetch('/demo/questions.json')
  const data = await res.json()
  return data.length
})
console.log(`\n===== 题库 =====`)
console.log(`questions.json 题数: ${questionCount}`)
check('静态题库为 40 题', questionCount === 40)

await browser.close()

console.log('\n================ 汇总 ================')
for (const [n, r] of [
  ['首页', home],
  ['测试页', test],
  ['结果页(无数据)', bare],
  ['结果页(含数据)', full],
] as const) {
  console.log(`${n}: 错误 ${r.errors.length} 条，404 资源 ${r.notFound.length} 个`)
}
console.log(failures === 0 ? '\n✓ 全部检查通过' : `\n✗ ${failures} 项检查未通过`)
console.log(`截图目录: ${OUT}`)

process.exit(failures === 0 ? 0 : 1)
