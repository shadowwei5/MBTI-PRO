// ============================================================
// MBTI-PRO 一次性扫码登录脚本
// 用途：在 publish-one-click 使用的同一个 Chrome persistent profile 里
//       弹出抖音 + 小红书创作者中心，让用户扫码登录一次；
//       登录状态会写入 profileDir，后续所有 publish-one-click 都自动带登录。
// ============================================================
import { chromium, type BrowserContext, type Page } from 'playwright'
import { existsSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { setTimeout as sleep } from 'node:timers/promises'

const ROOT = resolve(import.meta.dirname, '..', '..')
const AUTOMATION_PROFILE = join(ROOT, 'content-marketing', 'automation', 'state', 'chrome-profile')

if (!existsSync(AUTOMATION_PROFILE)) mkdirSync(AUTOMATION_PROFILE, { recursive: true })

const DOUYIN_URL = 'https://creator.douyin.com/creator-micro/content/upload'
const XHS_URL = 'https://creator.xiaohongshu.com/publish/publish?source=official'

async function isDouyinLoggedIn(page: Page): Promise<boolean> {
  // 判定登录：URL 不含 login，且能看到"发布视频/上传视频/上传"相关的入口或文件输入
  const url = page.url()
  if (/\/login|passport/.test(url)) return false
  const hasFile = await page.locator('input[type=file][accept*=video]').count().catch(() => 0)
  if (hasFile > 0) return true
  // fallback：看到扫码/请使用抖音App 就是没登
  const qrHits = await page.locator('text=/扫码登录|请使用抖音App|使用抖音手机版扫码/').count().catch(() => 0)
  return qrHits === 0
}

async function isXhsLoggedIn(page: Page): Promise<boolean> {
  const url = page.url()
  if (/\/login|\/signin/.test(url)) return false
  // 未登录时右上角是"登录"按钮或页面里有"登录后发布你的第一篇笔记"
  const notLoginHits = await page.locator('text=/登录后发布你的第一篇笔记|扫码登录/').count().catch(() => 0)
  if (notLoginHits > 0) return false
  // 已登录时上传入口会显示（"上传视频" tab / 文件选择）
  const uploadHits = await page.locator('text=/^上传视频$|^上传图文$|拖拽视频到此/').count().catch(() => 0)
  if (uploadHits > 0) return true
  const hasFile = await page.locator('input[type=file]').count().catch(() => 0)
  return hasFile > 0
}

async function main() {
  console.log('==========================================')
  console.log('  MBTI-PRO 一次性扫码登录（抖音 + 小红书）')
  console.log('==========================================')
  console.log('Profile 目录：', AUTOMATION_PROFILE)
  console.log('将同时打开两个创作者中心，请分别扫码登录。')
  console.log('两个平台都登录成功后，脚本会自动检测并提示继续。\n')

  const context: BrowserContext = await chromium.launchPersistentContext(AUTOMATION_PROFILE, {
    headless: false,
    channel: 'chrome',
    viewport: { width: 1280, height: 820 },
    args: ['--disable-blink-features=AutomationControlled'],
  })

  // 关掉默认空白页
  const pages = context.pages()
  const douyinPage = pages[0] ?? await context.newPage()
  const xhsPage = await context.newPage()

  await douyinPage.bringToFront()
  await douyinPage.goto(DOUYIN_URL, { waitUntil: 'domcontentloaded' }).catch(() => undefined)
  await xhsPage.goto(XHS_URL, { waitUntil: 'domcontentloaded' }).catch(() => undefined)

  console.log('▶ 抖音创作者中心已打开：', DOUYIN_URL)
  console.log('▶ 小红书创作者中心已打开：', XHS_URL)
  console.log('\n请在浏览器里分别用手机扫码登录（两个 tab 各一次）。')
  console.log('脚本每 5s 自动检测一次登录状态，全部就绪后会提示按回车关闭。\n')

  let douyinOk = false
  let xhsOk = false
  const deadline = Date.now() + 15 * 60 * 1000 // 最长等 15 分钟

  while (Date.now() < deadline) {
    try {
      if (!douyinOk) douyinOk = await isDouyinLoggedIn(douyinPage)
    } catch {}
    try {
      if (!xhsOk) xhsOk = await isXhsLoggedIn(xhsPage)
    } catch {}
    const stamp = new Date().toLocaleTimeString()
    console.log(`[${stamp}] 抖音：${douyinOk ? '✅ 已登录' : '⏳ 等待扫码'}   小红书：${xhsOk ? '✅ 已登录' : '⏳ 等待扫码'}`)
    if (douyinOk && xhsOk) break
    await sleep(5000)
  }

  if (!douyinOk || !xhsOk) {
    console.log('\n⚠️ 超时（15 分钟）仍有平台未检测到登录，继续保留 profile。')
  } else {
    console.log('\n🎉 两个平台都已登录，profile 状态已持久化到磁盘。')
  }

  const rl = createInterface({ input, output })
  await rl.question('\n按回车关闭浏览器并结束脚本…')
  rl.close()

  await context.close().catch(() => undefined)
  console.log('已关闭浏览器。后续运行 publish-one-click 时不再需要重新扫码（除非 cookie 过期）。')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
