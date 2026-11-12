// ============================================================
// MBTI-PRO — Chrome 半自动填表发布 Adapter
//
// 目标：连接 Chrome 调试端口，打开抖音/小红书发布页，上传视频/封面，填标题/正文。
// 安全边界：永不自动点击“发布”。填完后截图，等待人工审核。
// ============================================================

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
import { chromium, type BrowserContext, type Page } from 'playwright'

const ROOT_DIR = resolve(import.meta.dirname, '..', '..')
const CONTENT_DIR = join(ROOT_DIR, 'content-marketing')
const AUTOMATION_DIR = join(CONTENT_DIR, 'automation')
const DRAFT_DIR = join(AUTOMATION_DIR, 'drafts')
const SCREENSHOT_DIR = join(AUTOMATION_DIR, 'screenshots')
const LOG_DIR = join(AUTOMATION_DIR, 'logs')
const CALENDAR_PATH = join(CONTENT_DIR, 'publish-calendar.json')
const DEFAULT_CDP = 'http://127.0.0.1:9222'
const AUTOMATION_PROFILE = join(AUTOMATION_DIR, 'state', 'chrome-profile')

type Platform = 'douyin' | 'xiaohongshu'

interface Options {
  draftPath?: string
  typeCode?: string
  platforms: Platform[]
  cdp: string
  launch: boolean
  profileDir: string
  timeoutMs: number
  waitLogin: boolean
  closeBrowser: boolean
}

interface PlatformCopy {
  platform: Platform
  title: string
  description: string
  hashtags: string[]
  firstComment: string
  publishUrl: string
}

interface PreparedDraft {
  id: string
  kind: string
  typeCode: string
  typeName: string
  videoPath: string
  coverPath: string
  coverPathByPlatform?: { douyin?: string; xiaohongshu?: string }
  copies: PlatformCopy[]
}

interface FillResult {
  platform: Platform
  success: boolean
  screenshotPath?: string
  loginRequired?: boolean
  publishButtonDetected?: boolean
  warnings: string[]
  error?: string
}

function ensureDir(dirPath: string) {
  if (!existsSync(dirPath)) mkdirSync(dirPath, { recursive: true })
}

function parseArgs(): Options {
  const args = process.argv.slice(2)
  const options: Options = {
    platforms: ['douyin', 'xiaohongshu'],
    cdp: process.env.CHROME_CDP_URL || DEFAULT_CDP,
    launch: false,
    profileDir: process.env.MBTIPRO_CHROME_PROFILE || AUTOMATION_PROFILE,
    timeoutMs: 90_000,
    waitLogin: true,
    closeBrowser: false,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--draft') options.draftPath = args[index + 1]
    if (arg === '--type') options.typeCode = (args[index + 1] || '').toUpperCase()
    if (arg === '--platforms' || arg === '--platform') options.platforms = parsePlatforms(args[index + 1] || '')
    if (arg === '--cdp') options.cdp = args[index + 1] || DEFAULT_CDP
    if (arg === '--launch') options.launch = true
    if (arg === '--profile-dir') options.profileDir = args[index + 1] || AUTOMATION_PROFILE
    if (arg === '--timeout') options.timeoutMs = Math.max(15_000, Number(args[index + 1] || 90) * 1000)
    if (arg === '--no-wait-login') options.waitLogin = false
    if (arg === '--close-browser') options.closeBrowser = true
  }

  return options
}

function parsePlatforms(value: string): Platform[] {
  const platforms = value.split(',').map(item => item.trim()).filter(Boolean) as Platform[]
  const supported = new Set(['douyin', 'xiaohongshu'])
  const invalid = platforms.filter(platform => !supported.has(platform))
  if (invalid.length > 0) throw new Error(`暂不支持平台：${invalid.join(', ')}`)
  return platforms.length > 0 ? [...new Set(platforms)] : ['douyin', 'xiaohongshu']
}

function findDraftPath(typeCode?: string) {
  if (!existsSync(DRAFT_DIR)) return null
  const files = readdirSync(DRAFT_DIR)
    .filter(name => name.endsWith('.json'))
    .filter(name => !typeCode || name.toUpperCase().includes(typeCode.toUpperCase()))
    .sort((a, b) => b.localeCompare(a))
  return files[0] ? join(DRAFT_DIR, files[0]) : null
}

function loadDraft(options: Options): PreparedDraft {
  const draftPath = options.draftPath || findDraftPath(options.typeCode)
  if (!draftPath || !existsSync(draftPath)) {
    throw new Error(`找不到发布草稿。请先运行 npm run publish:prepare -- --type <CODE>。当前路径：${draftPath || '(empty)'}`)
  }
  const draft = JSON.parse(readFileSync(draftPath, 'utf-8')) as PreparedDraft
  if (!existsSync(draft.videoPath)) throw new Error(`视频不存在：${draft.videoPath}`)
  if (!existsSync(draft.coverPath)) throw new Error(`封面不存在：${draft.coverPath}`)
  return draft
}

function findChromeExecutable() {
  if (process.platform !== 'win32') return 'google-chrome'
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe') : undefined,
  ].filter(Boolean) as string[]
  return candidates.find(candidate => existsSync(candidate)) || 'chrome.exe'
}

function cdpPort(cdpUrl: string) {
  try { return new URL(cdpUrl).port || '9222' } catch { return '9222' }
}

async function waitForCdp(cdpUrl: string, timeoutMs: number) {
  const versionUrl = new URL('/json/version', cdpUrl).toString()
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(versionUrl)
      if (response.ok) return
    } catch {}
    await sleep(500)
  }
  throw new Error(`Chrome 调试端口未就绪：${cdpUrl}`)
}

async function launchExternalChrome(options: Options) {
  ensureDir(options.profileDir)
  const port = cdpPort(options.cdp)
  const chromePath = findChromeExecutable()
  const child = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${options.profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-blink-features=AutomationControlled',
    'about:blank',
  ], { detached: true, stdio: 'ignore', windowsHide: false })
  child.unref()
  await waitForCdp(options.cdp, Math.min(options.timeoutMs, 30_000))
}

async function connectBrowser(options: Options): Promise<{ context: BrowserContext; close: () => Promise<void> }> {
  if (options.launch) {
    ensureDir(options.profileDir)
    const context = await chromium.launchPersistentContext(options.profileDir, {
      executablePath: findChromeExecutable(),
      headless: false,
      viewport: { width: 1440, height: 1000 },
      args: [
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-blink-features=AutomationControlled',
      ],
    })
    return {
      context,
      close: async () => {
        if (options.closeBrowser) await context.close()
      },
    }
  }

  try {
    const browser = await chromium.connectOverCDP(options.cdp, { timeout: 10_000 })
    const context = browser.contexts()[0] || await browser.newContext({ viewport: { width: 1440, height: 1000 } })
    return {
      browser,
      context,
      close: async () => {
        if (options.closeBrowser) await browser.close()
        else await browser.contexts()[0]?.pages()[0]?.evaluate(() => undefined).catch(() => undefined)
      },
    }
  } catch (error) {
    throw new Error(`无法连接 Chrome 调试端口 ${options.cdp}。请用 --launch 打开专用 Chrome，或用 --cdp 指定已开启 remote debugging 的 Chrome。原始错误：${String(error)}`)
  }
}

async function getPage(context: any, url: string) {
  const page = await context.newPage()
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.waitForTimeout(2500)
  return page as Page
}

async function visibleText(page: Page) {
  return await page.locator('body').innerText({ timeout: 5000 }).catch(() => '')
}

async function detectLoginRequired(page: Page) {
  const text = await visibleText(page)
  return /登录|扫码|验证码|请先登录|未登录|手机登录|账号登录/.test(text) && !/发布|上传视频|上传作品|发布笔记/.test(text)
}

async function clickTextIfPresent(page: Page, patterns: Array<string | RegExp>) {
  for (const pattern of patterns) {
    const locator = page.getByText(pattern).first()
    if (await locator.count().catch(() => 0)) {
      await locator.click({ timeout: 3000 }).catch(() => undefined)
      await page.waitForTimeout(800)
      return true
    }
  }
  return false
}

async function waitForUploadSurface(page: Page, result: FillResult, options: Options) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < (options.waitLogin ? options.timeoutMs : 1)) {
    const loginRequired = await detectLoginRequired(page)
    let fileInputCount = await page.locator('input[type="file"]').count().catch(() => 0)
    if (!loginRequired && fileInputCount > 0) return

    if (!loginRequired && fileInputCount === 0) {
      await clickTextIfPresent(page, [/上传视频|发布视频|上传作品|发布笔记|上传|选择视频/])
      await page.waitForTimeout(1500)
      fileInputCount = await page.locator('input[type="file"]').count().catch(() => 0)
      if (fileInputCount > 0) return
    }

    if (!options.waitLogin) break
    result.loginRequired = loginRequired
    await page.waitForTimeout(3000)
  }

  const text = await visibleText(page)
  if (/登录|扫码|验证码|请先登录|未登录|手机登录|账号登录/.test(text)) {
    result.loginRequired = true
    result.warnings.push('页面需要登录/扫码/验证。请在打开的 Chrome 窗口完成后重新运行同一命令。')
  } else {
    result.warnings.push('暂未发现文件上传 input，可能需要先点击“上传视频/发布视频”入口，或平台页面结构已变化。')
  }
}

async function setFirstMatchingFile(page: Page, filePath: string, mode: 'video' | 'image') {
  const inputs = await page.locator('input[type="file"]').elementHandles()
  const scored: Array<{ index: number; score: number; accept: string }> = []

  for (let index = 0; index < inputs.length; index += 1) {
    const accept = await inputs[index].getAttribute('accept').catch(() => '') || ''
    let score = 0
    if (mode === 'video' && /video|mp4|\*/i.test(accept)) score += 3
    if (mode === 'image' && /image|png|jpg|jpeg|\*/i.test(accept)) score += 3
    if (mode === 'video' && /image/i.test(accept)) score -= 3
    if (mode === 'image' && /video/i.test(accept)) score -= 3
    scored.push({ index, score, accept })
  }

  scored.sort((a, b) => b.score - a.score)
  const target = scored.find(item => item.score > 0) || scored[0]
  if (!target) return false
  await inputs[target.index].setInputFiles(filePath)
  return true
}

async function fillByCandidates(page: Page, value: string, candidates: Array<string | RegExp>, kind: 'textbox' | 'input' = 'textbox') {
  for (const candidate of candidates) {
    const placeholder = page.getByPlaceholder(candidate as any).first()
    if (await placeholder.count().catch(() => 0)) {
      await placeholder.fill(value).catch(async () => {
        await placeholder.click()
        await placeholder.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
        await placeholder.type(value, { delay: 8 })
      })
      return true
    }
  }

  for (const candidate of candidates) {
    const label = page.getByLabel(candidate as any).first()
    if (await label.count().catch(() => 0)) {
      await label.fill(value).catch(async () => {
        await label.click()
        await label.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
        await label.type(value, { delay: 8 })
      })
      return true
    }
  }

  const selector = kind === 'input'
    ? 'input:not([type="file"]):not([type="hidden"]), textarea, [contenteditable="true"]'
    : 'textarea, [contenteditable="true"], input:not([type="file"]):not([type="hidden"])'
  const handles = await page.locator(selector).elementHandles()
  for (const handle of handles) {
    const box = await handle.boundingBox().catch(() => null)
    if (!box || box.width < 120 || box.height < 20) continue
    if (await handle.getAttribute('disabled').catch(() => null)) continue
    await handle.click().catch(() => undefined)
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A').catch(() => undefined)
    await page.keyboard.type(value, { delay: 8 }).catch(() => undefined)
    const text = await page.evaluate(el => (el as HTMLInputElement).value || el.textContent || '', handle).catch(() => '')
    if (text.includes(value.slice(0, Math.min(value.length, 12)))) return true
  }

  return false
}

async function fillDouyin(page: Page, draft: PreparedDraft, copy: PlatformCopy, result: FillResult, options: Options) {
  await waitForUploadSurface(page, result, options)
  const uploaded = await setFirstMatchingFile(page, draft.videoPath, 'video')
  if (!uploaded) result.warnings.push('未找到视频上传 input，请手动上传视频。')
  else await page.waitForTimeout(8000)

  await clickTextIfPresent(page, [/编辑封面|选择封面|上传封面|更换封面/])
  const douyinCover = draft.coverPathByPlatform?.douyin && existsSync(draft.coverPathByPlatform.douyin) ? draft.coverPathByPlatform.douyin : draft.coverPath
  const coverUploaded = await setFirstMatchingFile(page, douyinCover, 'image').catch(() => false)
  if (!coverUploaded) result.warnings.push('未能自动上传封面，请手动选择封面。')
  await page.waitForTimeout(1500)

  const titleFilled = await fillByCandidates(page, copy.title, [/标题|添加作品标题|填写作品标题|请输入标题/], 'input')
  if (!titleFilled) result.warnings.push('未能确认标题字段，可能需要手动复制标题。')

  const descriptionFilled = await fillByCandidates(page, copy.description, [/简介|描述|添加作品描述|填写作品简介|说点什么|请输入正文/])
  if (!descriptionFilled) result.warnings.push('未能确认正文/简介字段，可能需要手动复制正文。')
}

async function fillXiaohongshu(page: Page, draft: PreparedDraft, copy: PlatformCopy, result: FillResult, options: Options) {
  await waitForUploadSurface(page, result, options)
  const uploaded = await setFirstMatchingFile(page, draft.videoPath, 'video')
  if (!uploaded) result.warnings.push('未找到视频上传 input，请手动上传视频。')
  else await page.waitForTimeout(8000)

  await clickTextIfPresent(page, [/上传封面|选择封面|编辑封面|更换封面/])
  const xhsCover = draft.coverPathByPlatform?.xiaohongshu && existsSync(draft.coverPathByPlatform.xiaohongshu) ? draft.coverPathByPlatform.xiaohongshu : draft.coverPath
  const coverUploaded = await setFirstMatchingFile(page, xhsCover, 'image').catch(() => false)
  if (!coverUploaded) result.warnings.push('未能自动上传封面，请手动选择封面。')
  await page.waitForTimeout(1500)

  const titleFilled = await fillByCandidates(page, copy.title, [/标题|填写标题|请输入标题|添加标题/], 'input')
  if (!titleFilled) result.warnings.push('未能确认标题字段，可能需要手动复制标题。')

  const descriptionFilled = await fillByCandidates(page, copy.description, [/正文|描述|填写正文|添加正文|分享你的经验|请输入正文|说点什么/])
  if (!descriptionFilled) result.warnings.push('未能确认正文/简介字段，可能需要手动复制正文。')
}

async function detectPublishButton(page: Page) {
  return (await page.getByText(/发布|立即发布|发布笔记/).count().catch(() => 0)) > 0
}

async function screenshot(page: Page, draft: PreparedDraft, platform: Platform) {
  ensureDir(SCREENSHOT_DIR)
  const screenshotPath = join(SCREENSHOT_DIR, `${draft.id}_${platform}_filled.png`)
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(async () => {
    await page.screenshot({ path: screenshotPath })
  })
  return screenshotPath
}

function markCalendarUploadedDraft(draft: PreparedDraft, results: FillResult[]) {
  if (!existsSync(CALENDAR_PATH) || draft.typeCode === 'MBTI-PRO') return
  const calendar = JSON.parse(readFileSync(CALENDAR_PATH, 'utf-8'))
  const item = calendar.items?.find((entry: any) => entry.code === draft.typeCode)
  if (!item) return
  item.status = item.status || {}
  item.status.uploadedDraft = results.some(result => result.success)
  item.notes = [
    item.notes,
    `Chrome 自动填表结果：${results.map(result => `${result.platform}=${result.success ? 'ok' : 'needs_review'}`).join(', ')}`,
  ].filter(Boolean).join('\n')
  for (const result of results) {
    if (!item.platforms?.[result.platform]) continue
    item.platforms[result.platform].draftScreenshotPath = result.screenshotPath || null
  }
  calendar.updatedAt = new Date().toISOString()
  writeFileSync(CALENDAR_PATH, `${JSON.stringify(calendar, null, 2)}\n`, 'utf-8')
  const recordsPath = join(CONTENT_DIR, 'records', 'publish-calendar.json')
  if (existsSync(join(CONTENT_DIR, 'records'))) writeFileSync(recordsPath, `${JSON.stringify(calendar, null, 2)}\n`, 'utf-8')
}

function saveResults(draft: PreparedDraft, results: FillResult[]) {
  ensureDir(LOG_DIR)
  const logPath = join(LOG_DIR, `${draft.id}.chrome-fill.json`)
  writeFileSync(logPath, `${JSON.stringify({ draftId: draft.id, results, filledAt: new Date().toISOString() }, null, 2)}\n`, 'utf-8')
  return logPath
}

function printStartupHelp() {
  console.log('\n如果连接不上当前 Chrome，有两种方式：')
  console.log('  方式 A：使用专用自动化 Chrome（需要在打开的新窗口里登录一次）')
  console.log('    npm run publish:fill:launch -- --type ENFJ --platforms douyin')
  console.log('  方式 B：手动启动带调试端口的 Chrome 后复用当前登录态')
  console.log('    chrome.exe --remote-debugging-port=9222')
}

async function main() {
  const options = parseArgs()
  const draft = loadDraft(options)
  const connector = await connectBrowser(options).catch(error => {
    printStartupHelp()
    throw error
  })

  const results: FillResult[] = []
  try {
    for (const platform of options.platforms) {
      const copy = draft.copies.find(item => item.platform === platform)
      if (!copy) throw new Error(`草稿中没有 ${platform} 文案。请重新运行 publish:prepare。`)
      const result: FillResult = { platform, success: false, warnings: [] }
      results.push(result)

      console.log(`\n🌐 打开 ${platform} 上传页：${copy.publishUrl}`)
      const page = await getPage(connector.context, copy.publishUrl)
      try {
        if (platform === 'douyin') await fillDouyin(page, draft, copy, result, options)
        if (platform === 'xiaohongshu') await fillXiaohongshu(page, draft, copy, result, options)
        result.publishButtonDetected = await detectPublishButton(page)
        result.screenshotPath = await screenshot(page, draft, platform)
        result.success = !result.loginRequired && result.warnings.length <= 1
      } catch (error) {
        result.error = String(error)
        result.screenshotPath = await screenshot(page, draft, platform).catch(() => undefined)
      }

      console.log(`  截图：${result.screenshotPath || '未生成'}`)
      if (result.warnings.length) console.log(`  需要注意：${result.warnings.join('；')}`)
      if (result.error) console.log(`  错误：${result.error}`)
      console.log('  已停止在发布前，请你人工检查页面，不会自动点击发布。')
    }
  } finally {
    await connector.close().catch(() => undefined)
  }

  const logPath = saveResults(draft, results)
  markCalendarUploadedDraft(draft, results)
  console.log(`\n✅ Chrome 填表流程结束，日志：${logPath}`)
  console.log('请在浏览器页面审核视频、封面、标题、正文和标签；确认无误后由你手动点击发布。')
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
