import { chromium } from 'playwright'
import fs from 'node:fs'

const SRC = 'file:///H:/ccwork/MBTI-PRO/docs/xhs-shop/shop-cards.html'
const OUT = 'H:/ccwork/MBTI-PRO/docs/xhs-shop/'
fs.mkdirSync(OUT, { recursive: true })

const b = await chromium.launch({ channel: 'chrome' })
const p = await b.newPage({ viewport: { width: 1200, height: 1600 }, deviceScaleFactor: 1 })
await p.goto(SRC, { waitUntil: 'networkidle' })
await p.waitForTimeout(400)
const pages = await p.$$('.page')
let i = 0
for (const el of pages) {
  i++
  const name = `商品图-${i}.png`
  await el.screenshot({ path: OUT + name })
  console.log('saved', name)
}
await b.close()
console.log('OK', i, '张')
