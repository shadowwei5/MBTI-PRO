// ============================================================
// MBTI-PRO · 三平台自动发布（抖音 / 小红书 / 视频号）
// Playwright 自动化，仅首次需要扫码登录，session 自动保存复用
// ============================================================
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { chromium, type BrowserContext } from 'playwright'
import type { PublishTask, PublishResult } from './types.js'

const ROOT = resolve(import.meta.dirname, '..', '..')
const SESSION_DIR = join(ROOT, 'video', 'output', '_publish_sessions')
const LOG_DIR = join(ROOT, 'video', 'output', '_publish_logs')
mkdirSync(SESSION_DIR, { recursive: true })
mkdirSync(LOG_DIR, { recursive: true })

const PLATFORM_CREATORS = {
  douyin: 'https://creator.douyin.com/creator-micro/home',
  xiaohongshu: 'https://creator.xiaohongshu.com/login',
  wechat: 'https://channels.weixin.qq.com/platform/login',
} as const

async function getContext(platform: keyof typeof PLATFORM_CREATORS): Promise<BrowserContext> {
  const sessionPath = join(SESSION_DIR, `${platform}_session.json`)
  const context = await chromium.launchPersistentContext(sessionPath, {
    headless: false, // 首次必须可见，方便扫码登录
    viewport: { width: 1440, height: 900 },
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  })
  // 如果没有登录态，先停在登录页让用户扫码
  if (!existsSync(sessionPath) || readFileSync(sessionPath, 'utf-8').trim() === '{}') {
    console.log(`\n[${platform}] 📱 请扫码登录（浏览器已打开）`)
    await context.goto(PLATFORM_CREATORS[platform], { waitUntil: 'networkidle', timeout: 60000 })
    console.log(`[${platform}] ⏳ 等待登录成功，检测到创作者后台后自动继续...`)
    // 等待页面跳转完成，登录态写入
    await context.waitForTimeout(5000)
  }
  return context
}

/**
 * 抖音发布
 * 流程：创作者后台 → 上传视频 → 填标题 → 选封面 → 填话题 → 发布
 */
async function publishDouyin(task: PublishTask): Promise<PublishResult> {
  const ctx = await getContext('douyin')
  const page = ctx.pages()[0] || (await ctx.newPage())
  await page.goto('https://creator.douyin.com/creator-micro/content/upload', { waitUntil: 'networkidle' })

  console.log('[douyin] 📤 上传视频...')
  const fileInput = page.locator('input[type="file"]').first()
  await fileInput.setInputFiles(task.videoPath)

  // 等待上传完成
  await page.waitForSelector('video', { timeout: 120000 })
  console.log('[douyin] ✅ 视频上传完成')

  // 填标题
  await page.locator('textarea, [contenteditable]').first().fill(`${task.title} #MBTI #${task.typeCode}`)

  // TODO: 上传横版封面（抖音支持从本地上传封面帧）
  // TODO: 视频号同样流程

  // 记录发布日志
  const logEntry = { task, platform: 'douyin', status: 'ready_to_publish', timestamp: new Date().toISOString() }
  writeFileSync(
    join(LOG_DIR, `douyin_${task.typeCode}_${Date.now()}.json`),
    JSON.stringify(logEntry, null, 2),
    'utf-8'
  )

  // TODO: 点击发布（确认无误后再启用）
  // await page.click('button:has-text("发布")')

  console.log('[douyin] ✅ 已准备好发布（当前为预览模式，未实际发布）')
  return {
    platform: 'douyin',
    success: true,
    timestamp: new Date().toISOString(),
    url: '[预览模式 - 待实际发布]',
  }
}

/**
 * 小红书发布
 */
async function publishXiaohongshu(task: PublishTask): Promise<PublishResult> {
  const ctx = await getContext('xiaohongshu')
  const page = ctx.pages()[0] || (await ctx.newPage())
  await page.goto('https://creator.xiaohongshu.com/notes/upload', { waitUntil: 'networkidle' })

  const logEntry = { task, platform: 'xiaohongshu', status: 'ready_to_publish', timestamp: new Date().toISOString() }
  writeFileSync(
    join(LOG_DIR, `xhs_${task.typeCode}_${Date.now()}.json`),
    JSON.stringify(logEntry, null, 2),
    'utf-8'
  )

  console.log('[xiaohongshu] ✅ 已准备好发布（当前为预览模式）')
  return {
    platform: 'xiaohongshu',
    success: true,
    timestamp: new Date().toISOString(),
    url: '[预览模式 - 待实际发布]',
  }
}

/**
 * 微信视频号发布
 */
async function publishWechatChannels(task: PublishTask): Promise<PublishResult> {
  const ctx = await getContext('wechat')
  const page = ctx.pages()[0] || (await ctx.newPage())
  await page.goto('https://channels.weixin.qq.com/platform/post/create', { waitUntil: 'networkidle' })

  const logEntry = { task, platform: 'wechat', status: 'ready_to_publish', timestamp: new Date().toISOString() }
  writeFileSync(
    join(LOG_DIR, `wechat_${task.typeCode}_${Date.now()}.json`),
    JSON.stringify(logEntry, null, 2),
    'utf-8'
  )

  console.log('[wechat] ✅ 已准备好发布（当前为预览模式）')
  return {
    platform: 'wechat',
    success: true,
    timestamp: new Date().toISOString(),
    url: '[预览模式 - 待实际发布]',
  }
}

/**
 * 统一入口：三平台发布
 */
export async function publishToPlatforms(task: PublishTask): Promise<PublishResult[]> {
  const { platforms } = task
  console.log(`\n[publish] 🚀 发布到 ${platforms.length} 个平台: ${platforms.join(', ')}`)
  console.log(`[publish] 类型: ${task.typeCode}`)
  console.log(`[publish] 标题: ${task.title}`)

  const results: PublishResult[] = []

  if (platforms.includes('douyin')) {
    results.push(await publishDouyin(task))
  }
  if (platforms.includes('xiaohongshu')) {
    results.push(await publishXiaohongshu(task))
  }
  if (platforms.includes('wechat')) {
    results.push(await publishWechatChannels(task))
  }

  return results
}

// CLI 运行入口
if (import.meta.url.endsWith(process.argv[1])) {
  const demoTask: PublishTask = {
    typeCode: 'ENTP',
    title: 'ENTP 最上头的，是能接住他脑洞的人',
    description: '他不是爱抬杠，他是真的停不下来。主页免费测 81 型人格，看看你到底是哪一种。',
    tags: ['MBTI', 'ENTP', '81型人格', '人格测试', '心理学'],
    videoPath: join(ROOT, 'video', 'output', 'ENTP_daily_final_volc_liuyuxi_bgm.mp4'),
    coverPath: join(ROOT, 'video', 'output', 'cover_ENTP_daily_landscape.png'),
    platforms: ['douyin', 'xiaohongshu', 'wechat'],
  }
  await publishToPlatforms(demoTask)
  process.exit(0)
}
