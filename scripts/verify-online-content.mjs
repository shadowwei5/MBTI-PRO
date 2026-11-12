#!/usr/bin/env node
/**
 * 上线后内容验收：用一张兑换码拉取付费正文，逐项断言改版是否真的生效。
 *
 * 为什么需要它：结果页 / PDF 的正文由「兑换码 → accessToken → 付费字段」这条链条返回，
 * 只看首页截图看不出内容对不对；人工点一遍容易漏项。这个脚本把验收项写成断言。
 *
 * 用法：
 *   node scripts/verify-online-content.mjs --code=XXXX-XXXX
 *   node scripts/verify-online-content.mjs --code=XXXX-XXXX --origin=http://127.0.0.1:3001
 *
 * 注意：会真实兑换 1 次（占用该码 1 个兑换额度），请用预留的测试码。
 * 退出码：0 全部通过 / 1 有断言失败 / 2 参数或网络错误
 */
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/)
    return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true]
  }),
)

const ORIGIN = String(args.origin || 'https://mbti-pro.com').replace(/\/$/, '')
const CODE = args.code
if (!CODE || CODE === true) {
  console.error('缺少 --code=<兑换码>，例如 --code=ABCD-1234')
  process.exit(2)
}

const MODULES = ['eiModule', 'snModule', 'tfModule', 'pjModule']
const LABELS = { eiModule: '起点与志向', snModule: '看世界的角度', tfModule: '关键抉择', pjModule: '代价与教训' }
const MAIN_PERSON = 'ABFP'
const SECOND = 'ABCD'

const results = []
const ok = (name, extra = '') => results.push({ pass: true, name, extra })
const ng = (name, extra = '') => results.push({ pass: false, name, extra })
const check = (cond, name, extra = '') => (cond ? ok(name, extra) : ng(name, extra))

async function getJson(path, init) {
  const res = await fetch(ORIGIN + path, init)
  const text = await res.text()
  let body
  try {
    body = JSON.parse(text)
  } catch {
    body = { success: false, error: `非 JSON 响应（HTTP ${res.status}）：${text.slice(0, 120)}` }
  }
  return { status: res.status, body }
}

const clean = (s) => String(s || '').replace(/\s/g, '')

function dupWindows(a, b, size = 15) {
  const setB = new Set()
  for (let i = 0; i + size <= b.length; i++) setB.add(b.slice(i, i + size))
  const hits = []
  for (let i = 0; i + size <= a.length; i++) {
    const w = a.slice(i, i + size)
    if (setB.has(w)) hits.push(w)
  }
  return hits
}

async function main() {
  console.log(`=== 上线内容验收 ===`)
  console.log(`站点    ${ORIGIN}`)
  console.log(`兑换码  ${String(CODE).slice(0, 4)}****（会占用 1 次兑换额度）`)
  console.log('')

  const health = await getJson('/api/health')
  check(health.status === 200, '站点健康检查 /api/health', `HTTP ${health.status}`)

  const redeem = await getJson('/api/access/redeem', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: CODE }),
  })
  const token = redeem.body?.data?.accessToken
  check(!!token, '兑换码换取 accessToken', redeem.body?.error || `HTTP ${redeem.status}`)
  if (!token) return finish()

  const fetchType = async (code) => {
    const r = await getJson(`/api/results/${code}?token=${encodeURIComponent(token)}`)
    return r.body?.data || null
  }

  const main = await fetchType(MAIN_PERSON)
  check(!!main, `拉取 ${MAIN_PERSON} 报告`, main ? '' : '返回空')
  if (!main) return finish()

  check(main.paid === true, '付费字段已解锁（paid=true）')
  check(String(main.name).length > 0, `类型名存在：${main.name}`)

  const stories = main.celebrityStories || []
  check(stories.length === 4, '代表人物 4 位', `实际 ${stories.length} 位`)
  check(
    stories.every((p) => p.field && p.field !== '公众人物'),
    '4 位代表人物全部带身份（无「公众人物」兜底）',
    stories.map((p) => `${p.name}:${p.field || '空'}`).join(' / '),
  )
  check(
    (stories[0] || {}).name === '丰子恺',
    'ABFP 主人物已换为丰子恺（第 1 位）',
    `实际第 1 位：${(stories[0] || {}).name}`,
  )
  check(
    stories.some((p) => p.name === '梭罗'),
    '梭罗仍在名单内（换的是主人物，不是删人）',
  )

  const texts = MODULES.map((k) => String(main[k] || ''))
  check(texts.every((t) => t.length > 0), '四条解读全部返回', texts.map((t) => t.length).join('/'))
  check(texts.every((t) => !/[【】]/.test(t)), '四条解读无【】草稿标签')
  check(texts.every((t) => t.includes('给你的建议：')), '四条解读都以「给你的建议：」收束')
  check(texts.every((t) => !/。\s+给你的建议/.test(t)), '无「。 给你的建议」全角空格')
  check(texts.every((t) => !/(E\/A\/I|T\/C\/F|S\/B\/N|P\/J\/D)\s*维度/.test(t)), '无内部维度代码外泄')

  const mainLen = clean(texts.join('')).length
  check(mainLen >= 420, `ABFP 四条合计 ≥420 字`, `实际 ${mainLen} 字`)

  const second = await fetchType(SECOND)
  if (second?.paid) {
    const secondText = clean(MODULES.map((k) => second[k]).join(''))
    const hits = dupWindows(clean(texts.join('')), secondText)
    check(hits.length === 0, `ABFP 与 ${SECOND} 无 ≥15 字相同片段`, hits.slice(0, 3).join(' / '))
  } else {
    ng(`拉取 ${SECOND} 报告`, '未取到付费字段（可能该码额度已用尽）')
  }

  return finish()
}

function finish() {
  console.log('')
  for (const r of results) console.log(`${r.pass ? '  PASS' : '  FAIL'}  ${r.name}${r.extra ? `　（${r.extra}）` : ''}`)
  const bad = results.filter((r) => !r.pass)
  console.log('')
  if (bad.length) {
    console.log(`✗ ${bad.length} 项未通过（共 ${results.length} 项）`)
    process.exit(1)
  }
  console.log(`✓ 全部 ${results.length} 项通过`)
  process.exit(0)
}

main().catch((err) => {
  console.error('验收脚本异常：', err?.message || err)
  process.exit(2)
})
