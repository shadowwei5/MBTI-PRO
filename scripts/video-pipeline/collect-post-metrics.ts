// MBTI-PRO — Post-publish metrics collector
// Reads visible creator-center metrics from logged-in browser pages and saves snapshots.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { chromium, type BrowserContext, type Page } from 'playwright'

const ROOT_DIR = resolve(import.meta.dirname, '..', '..')
const CONTENT_DIR = join(ROOT_DIR, 'content-marketing')
const AUTOMATION_DIR = join(CONTENT_DIR, 'automation')
const LOG_DIR = join(AUTOMATION_DIR, 'metrics')
const SCREENSHOT_DIR = join(AUTOMATION_DIR, 'screenshots')
const PROFILE_DIR = join(AUTOMATION_DIR, 'state', 'chrome-profile')
const DEFAULT_CDP = 'http://127.0.0.1:9222'

const URLS = {
  douyinManage: 'https://creator.douyin.com/creator-micro/content/manage?enter_from=publish',
  xhsPublish: 'https://creator.xiaohongshu.com/publish/publish',
  xhsCreator: 'https://creator.xiaohongshu.com/creator/notes',
}

type Platform = 'douyin' | 'xiaohongshu'

interface Options {
  platforms: Platform[]
  cdp: string
  launch: boolean
  profileDir: string
  label: string
  waitMs: number
  closeBrowser: boolean
}

interface MetricSnapshot {
  platform: Platform
  collectedAt: string
  url: string
  title?: string
  rawText: string
  parsed: Record<string, string | number | null>
  screenshotPath?: string
  warnings: string[]
}

function ensureDir(path: string) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true })
}

function parsePlatforms(value: string): Platform[] {
  const platforms = value.split(',').map(item => item.trim()).filter(Boolean) as Platform[]
  const valid = new Set(['douyin', 'xiaohongshu'])
  const invalid = platforms.filter(platform => !valid.has(platform))
  if (invalid.length > 0) throw new Error(`Unsupported platforms: ${invalid.join(', ')}`)
  return platforms.length ? [...new Set(platforms)] : ['douyin', 'xiaohongshu']
}

function parseArgs(): Options {
  const args = process.argv.slice(2)
  const options: Options = {
    platforms: ['douyin', 'xiaohongshu'],
    cdp: process.env.CHROME_CDP_URL || DEFAULT_CDP,
    launch: false,
    profileDir: process.env.MBTIPRO_CHROME_PROFILE || PROFILE_DIR,
    label: 'latest',
    waitMs: 6_000,
    closeBrowser: false,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--platforms' || arg === '--platform') options.platforms = parsePlatforms(args[index + 1] || '')
    if (arg === '--cdp') options.cdp = args[index + 1] || DEFAULT_CDP
    if (arg === '--launch') options.launch = true
    if (arg === '--profile-dir') options.profileDir = args[index + 1] || PROFILE_DIR
    if (arg === '--label') options.label = sanitizeLabel(args[index + 1] || 'latest')
    if (arg === '--wait') options.waitMs = Math.max(1_000, Number(args[index + 1] || 6) * 1000)
    if (arg === '--close-browser') options.closeBrowser = true
  }

  return options
}

function sanitizeLabel(label: string) {
  return label.replace(/[^a-zA-Z0-9_\-\u4e00-\u9fa5]/g, '_').slice(0, 80) || 'latest'
}

function findChromeExecutable() {
  if (process.platform !== 'win32') return 'google-chrome'
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe') : undefined,
  ].filter(Boolean) as string[]
  return candidates.find(item => existsSync(item)) || 'chrome.exe'
}

async function launchChrome(options: Options) {
  ensureDir(options.profileDir)
  const chrome = findChromeExecutable()
  const args = [
    '--remote-debugging-port=9222',
    `--user-data-dir=${options.profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-popup-blocking',
  ]
  const child = spawn(chrome, args, { detached: true, stdio: 'ignore' })
  child.unref()
  await sleep(3500)
}

function sleep(ms: number) {
  return new Promise(resolvePromise => setTimeout(resolvePromise, ms))
}

async function connectBrowser(options: Options) {
  if (options.launch) await launchChrome(options)
  return chromium.connectOverCDP(options.cdp)
}

async function getPage(context: BrowserContext, url: string) {
  const page = context.pages()[0] || await context.newPage()
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  await page.waitForTimeout(2_000)
  return page
}

function normalizeText(text: string) {
  return text.replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

function firstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) return match[1].trim()
  }
  return null
}

function parseDouyin(text: string) {
  const firstWork = firstMatch(text, [/00:\d{2}\s*\n?([^\n]+?)(?:\n编辑作品|编辑作品)/s])
  return {
    firstWorkTitle: firstWork,
    publishTime: firstMatch(text, [/(20\d{2}年\d{2}月\d{2}日\s+\d{1,2}:\d{2})/]),
    status: firstMatch(text, [/(已发布|审核中|未通过|私密)/]),
    plays: firstMatch(text, [/播放\s*\n?\s*([\d,\.万-]+)/]),
    likes: firstMatch(text, [/点赞\s*\n?\s*([\d,\.万-]+)/]),
    comments: firstMatch(text, [/评论\s*\n?\s*([\d,\.万-]+)/]),
    shares: firstMatch(text, [/分享\s*\n?\s*([\d,\.万-]+)/]),
  }
}

function parseXiaohongshu(text: string) {
  return {
    publishedFlag: text.includes('published=true') ? 'published=true' : null,
    titleMentioned: firstMatch(text, [/(MBTI[^\n]{0,80})/]),
    latestNote: firstMatch(text, [/最新笔记\s*\n(?:查看详情\s*\n)?([^\n]+)/]),
    exposure: firstMatch(text, [/曝光数\s*\n?\s*([\d,\.万-]+)/]),
    views: firstMatch(text, [/观看数\s*\n?\s*([\d,\.万-]+)/, /(?:浏览|观看|播放)\s*([\d,\.万-]+)/]),
    coverClickRate: firstMatch(text, [/封面点击率\s*\n?\s*([\d\.%-]+)/]),
    completionRate: firstMatch(text, [/视频完播率\s*\n?\s*([\d\.%-]+)/]),
    likes: firstMatch(text, [/点赞数\s*\n?\s*([\d,\.万-]+)/, /点赞\s*([\d,\.万-]+)/]),
    collects: firstMatch(text, [/收藏数\s*\n?\s*([\d,\.万-]+)/, /收藏\s*([\d,\.万-]+)/]),
    comments: firstMatch(text, [/评论数\s*\n?\s*([\d,\.万-]+)/, /评论\s*([\d,\.万-]+)/]),
    shares: firstMatch(text, [/分享数\s*\n?\s*([\d,\.万-]+)/, /分享\s*([\d,\.万-]+)/]),
    profileVisitors: firstMatch(text, [/主页访客\s*\n?\s*([\d,\.万-]+)/]),
  }
}
async function saveScreenshot(page: Page, platform: Platform, label: string) {
  ensureDir(SCREENSHOT_DIR)
  const path = join(SCREENSHOT_DIR, `metrics_${platform}_${label}_${timestampForFile()}.png`)
  await page.screenshot({ path, fullPage: true }).catch(async () => page.screenshot({ path }))
  return path
}

function timestampForFile() {
  return new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)
}

async function collectDouyin(context: BrowserContext, options: Options): Promise<MetricSnapshot> {
  const page = await getPage(context, URLS.douyinManage)
  await page.waitForTimeout(options.waitMs)
  const rawText = normalizeText(await page.locator('body').innerText({ timeout: 20_000 }))
  const screenshotPath = await saveScreenshot(page, 'douyin', options.label)
  return {
    platform: 'douyin',
    collectedAt: new Date().toISOString(),
    url: page.url(),
    title: await page.title().catch(() => undefined),
    rawText,
    parsed: parseDouyin(rawText),
    screenshotPath,
    warnings: rawText.includes('登录') && !rawText.includes('作品管理') ? ['可能未登录或页面未加载到作品管理'] : [],
  }
}

async function collectXiaohongshu(context: BrowserContext, options: Options): Promise<MetricSnapshot> {
  const page = await getPage(context, URLS.xhsCreator)
  await page.waitForTimeout(options.waitMs)
  const rawText = normalizeText(await page.locator('body').innerText({ timeout: 20_000 }))
  const screenshotPath = await saveScreenshot(page, 'xiaohongshu', options.label)
  return {
    platform: 'xiaohongshu',
    collectedAt: new Date().toISOString(),
    url: page.url(),
    title: await page.title().catch(() => undefined),
    rawText,
    parsed: parseXiaohongshu(rawText),
    screenshotPath,
    warnings: rawText.includes('小红书账号') || rawText.includes('笔记数据总览') ? [] : ['可能未登录，或当前页面不是作品/数据管理页'],
  }
}

function saveSnapshots(label: string, snapshots: MetricSnapshot[]) {
  ensureDir(LOG_DIR)
  const path = join(LOG_DIR, `${label}_${timestampForFile()}.json`)
  writeFileSync(path, `${JSON.stringify({ label, snapshots }, null, 2)}\n`, 'utf-8')
  return path
}

function printSummary(snapshots: MetricSnapshot[], path: string) {
  console.log(`\n✅ 数据采集完成：${path}`)
  for (const snapshot of snapshots) {
    console.log(`\n[${snapshot.platform}] ${snapshot.url}`)
    console.log(JSON.stringify(snapshot.parsed, null, 2))
    if (snapshot.screenshotPath) console.log(`截图：${snapshot.screenshotPath}`)
    if (snapshot.warnings.length) console.log(`注意：${snapshot.warnings.join('；')}`)
  }
}

async function main() {
  const options = parseArgs()
  const browser = await connectBrowser(options)
  const context = browser.contexts()[0] || await browser.newContext()
  const snapshots: MetricSnapshot[] = []

  try {
    for (const platform of options.platforms) {
      if (platform === 'douyin') snapshots.push(await collectDouyin(context, options))
      if (platform === 'xiaohongshu') snapshots.push(await collectXiaohongshu(context, options))
    }
  } finally {
    await browser.close().catch(() => undefined)
  }

  const logPath = saveSnapshots(options.label, snapshots)
  printSummary(snapshots, logPath)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})


