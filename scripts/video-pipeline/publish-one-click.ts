// ============================================================
// MBTI-PRO · 一键发布（扫码一次登录 + 敲 y 确认 = 自动填表 + 自动点击发布）
//
// 关键点：整个流程在一个 Node 进程 + 一个 Chrome 持久化 profile 里完成，
// 保证扫码一次即可，后续都免登录：
//   profileDir = content-marketing\automation\state\chrome-profile
//
// 流程：
//   1) launchPersistentContext(profileDir)：如未登录，自动打开登录页等你扫码。
//   2) 对每个平台：打开上传页 → 自动上传视频 + 平台对应封面 + 填标题/正文 → 截图。
//   3) 终端问 “y” → 定位并点击发布按钮 → 再截图归档。
//
// 安全边界：
//   - 默认必须终端敲 y 才会点击“发布”。
//   - --yes 才会跳过确认（不推荐用于抖音）。
//
// 用法：
//   npm run publish:one-click -- --type INTP --platforms douyin,xiaohongshu
// ============================================================
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { chromium, type BrowserContext, type Page } from 'playwright'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { setTimeout as sleep } from 'node:timers/promises'

const ROOT = resolve(import.meta.dirname, '..', '..')
const CONTENT_DIR = join(ROOT, 'content-marketing')
const AUTOMATION_DIR = join(CONTENT_DIR, 'automation')
const DRAFT_DIR = join(AUTOMATION_DIR, 'drafts')
const SCREENSHOT_DIR = join(AUTOMATION_DIR, 'screenshots')
const LOG_DIR = join(AUTOMATION_DIR, 'logs')
const AUTOMATION_PROFILE = join(AUTOMATION_DIR, 'state', 'chrome-profile')

type Platform = 'douyin' | 'xiaohongshu'

interface Options {
  typeCode?: string
  draftPath?: string
  platforms: Platform[]
  profileDir: string
  timeoutMs: number
  autoConfirm: boolean
  xhsForce?: boolean
  loginWaitMs: number
  prepareOnly?: boolean
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

interface StepResult {
  platform: Platform
  filled: boolean
  loginRequired: boolean
  publishClicked: boolean
  warnings: string[]
  errors: string[]
  screenshotFilled?: string
  screenshotAfter?: string
  confirmedAt?: string
}

function ensureDir(p: string) { if (!existsSync(p)) mkdirSync(p, { recursive: true }) }

function parseArgs(): Options {
  const a = process.argv.slice(2)
  const opts: Options = {
    platforms: ['douyin', 'xiaohongshu'],
    profileDir: process.env.MBTIPRO_CHROME_PROFILE || AUTOMATION_PROFILE,
    timeoutMs: 120_000,
    autoConfirm: false,
    loginWaitMs: 180_000,
    prepareOnly: false,
    xhsForce: false,
  }
  for (let i = 0; i < a.length; i++) {
    const x = a[i]
    if (x === '--prepare-only' || x === '--no-publish') opts.prepareOnly = true
    else if (x === '--type' || x === '--code') opts.typeCode = (a[++i] || '').toUpperCase()
    else if (x === '--draft') opts.draftPath = a[++i]
    else if (x === '--platforms' || x === '--platform') {
      opts.platforms = String(a[++i] || '').split(',').map(s => s.trim()).filter(Boolean) as Platform[]
    }
    else if (x === '--profile-dir') opts.profileDir = a[++i] || AUTOMATION_PROFILE
    else if (x === '--timeout') opts.timeoutMs = Math.max(30_000, Number(a[++i] || 120) * 1000)
    else if (x === '--login-wait') opts.loginWaitMs = Math.max(30_000, Number(a[++i] || 180) * 1000)
    else if (x === '--yes' || x === '-y') opts.autoConfirm = true
    else if (x === '--xhs-force') opts.xhsForce = true
  }
  // XHS_COMPLIANCE_GUARD_v11: 2026-07-05 起小红书按新规将 Playwright 自动化列为『AI 及第三方托管』，默认拒绝跑该平台。
  if (opts.platforms.includes('xiaohongshu') && !opts.xhsForce) {
    const kept = opts.platforms.filter(p => p !== 'xiaohongshu')
    console.log('\n[XHS 合规守卫] 已跳过小红书自动化发布。')
    console.log('  原因: 小红书《AI 及第三方托管行为》规则将 Web + 自动化脚本发布判为违规。')
    console.log('  建议: 使用 scripts/video-pipeline/pack-manual-kit.ts 生成手动素材包, 用手机 App 发布。')
    console.log('  如需强制运行(仅调试用), 加参数 --xhs-force。\n')
    opts.platforms = kept
  }
  for (const p of opts.platforms) if (p !== 'douyin' && p !== 'xiaohongshu') throw new Error(`暂不支持平台: ${p}`)
  return opts
}

function findDraftPath(typeCode?: string) {
  if (!existsSync(DRAFT_DIR)) return null
  const files = readdirSync(DRAFT_DIR)
    .filter(n => n.endsWith('.json'))
    .filter(n => !typeCode || n.toUpperCase().includes(typeCode.toUpperCase()))
    .sort((x, y) => y.localeCompare(x))
  return files[0] ? join(DRAFT_DIR, files[0]) : null
}

function loadDraft(opts: Options): PreparedDraft {
  const p = opts.draftPath || findDraftPath(opts.typeCode)
  if (!p || !existsSync(p)) throw new Error(`找不到发布草稿。先运行: npm run publish:prepare -- --type <CODE>`)
  const d = JSON.parse(readFileSync(p, 'utf-8')) as PreparedDraft
  if (!existsSync(d.videoPath)) throw new Error(`视频不存在: ${d.videoPath}`)
  if (!existsSync(d.coverPath)) throw new Error(`封面不存在: ${d.coverPath}`)
  return d
}

// -------- 浏览器：单个持久化上下文，扫码一次后一直登录 --------
async function launchPersistent(opts: Options) {
  ensureDir(opts.profileDir)
  const context = await chromium.launchPersistentContext(opts.profileDir, {
    headless: false,
    viewport: { width: 1440, height: 1000 },
    args: [
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
    ],
  })
  return context
}

async function openPage(context: BrowserContext, url: string) {
  const page = await context.newPage()
  if (/xiaohongshu/.test(url)) {
    try { await page.goto('https://www.xiaohongshu.com', { waitUntil: 'domcontentloaded', timeout: 60_000 }); await page.waitForTimeout(2500) } catch {}
    try { await page.goto('https://creator.xiaohongshu.com', { waitUntil: 'domcontentloaded', timeout: 60_000 }); await page.waitForTimeout(2500) } catch {}
  }
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  try { await page.waitForLoadState('networkidle', { timeout: 30_000 }) } catch {}
  await page.waitForTimeout(3500)
  return page
}

async function visibleText(page: Page) {
  return await page.locator('body').innerText({ timeout: 5000 }).catch(() => '')
}

async function isLoginPage(page: Page) {
  const text = await visibleText(page)
  // 只要页面里出现扫码/请登录关键词，就一律判定为未登录，避免把"上传视频"tab 当成已登录。
  if (/扫码登录|扫描下方二维码|扫码后无操作|请先登录|未登录|手机登录|账号登录|使用抖音手机版扫码|请使用小红书 App 扫码|登录后发布你的第一篇笔记/.test(text)) return true
  const url = page.url()
  if (/\/login|passport|signin/.test(url)) return true
  return false
}

async function assertLoggedIn(page: Page, platform: Platform) {
  const text = await visibleText(page).catch(() => '')
  if (/扫码登录|使用抖音手机版扫码|使用小红书 App 扫码|登录后发布你的第一篇笔记/.test(text)) {
    throw new Error(`[${platform}] 检测到扫码/未登录页面，无法进入上传流程。请先运行 npm run publish:login-once 扫码登录。`)
  }
}

async function waitForLoginIfNeeded(context: BrowserContext, platform: Platform, opts: Options, result: StepResult) {
  const probe = await openPage(context, platform === 'douyin'
    ? 'https://creator.douyin.com/creator-micro/home'
    : 'https://creator.xiaohongshu.com/publish/publish')

  const needLogin = await isLoginPage(probe)
  if (!needLogin) { await probe.close().catch(() => undefined); return }

  console.log(`\n📱 [${platform}] 需要扫码登录。请用${platform === 'douyin' ? '抖音' : '小红书'} App 扫描浏览器窗口中的二维码。`)
  console.log(`   登录成功后本流程会自动继续（最多等 ${Math.round(opts.loginWaitMs / 1000)}s）。`)

  const started = Date.now()
  while (Date.now() - started < opts.loginWaitMs) {
    await probe.waitForTimeout(3000)
    if (!(await isLoginPage(probe))) {
      console.log(`✓ [${platform}] 检测到登录成功，会话已写入持久化 profile。`)
      await probe.close().catch(() => undefined)
      return
    }
  }
  result.loginRequired = true
  result.warnings.push('等待登录超时。请手动登录后重新运行本命令。')
  throw new Error(`${platform} 登录超时`)
}

// -------- 填表：上传视频 / 封面 / 标题 / 正文 --------
async function clickTextIfPresent(page: Page, patterns: Array<string | RegExp>) {
  for (const pat of patterns) {
    const locator = page.getByText(pat).first()
    if (await locator.count().catch(() => 0)) {
      await locator.click({ timeout: 3000 }).catch(() => undefined)
      await page.waitForTimeout(800)
      return true
    }
  }
  return false
}

async function waitForUploadSurface(page: Page, timeoutMs: number) {
  const started = Date.now()
  const videoSel = 'input[type="file"][accept*="video"], input[type="file"][accept*="mp4"], input.upload-input, input[type="file"][accept*=".mov"]'
  while (Date.now() - started < timeoutMs) {
    const hasVideoInput = await page.locator(videoSel).count().catch(() => 0)
    if (hasVideoInput > 0) return true
    const anyCount = await page.locator('input[type="file"]').count().catch(() => 0)
    if (anyCount === 0) {
      await clickTextIfPresent(page, [/上传视频|发布视频|上传作品|发布笔记|拖入视频|上传/])
    }
    await page.waitForTimeout(1500)
  }
  return false
}

async function setFile(page: Page, filePath: string, mode: 'video' | 'image'): Promise<boolean> {
  const inputs = await page.locator('input[type="file"]').elementHandles()
  const scored: Array<{ idx: number; score: number; accept: string }> = []
  for (let i = 0; i < inputs.length; i++) {
    const accept = (await inputs[i].getAttribute('accept').catch(() => '')) || ''
    let s = 0
    if (mode === 'video' && /video|mp4|\*/i.test(accept)) s += 3
    if (mode === 'image' && /image|png|jpg|jpeg|\*/i.test(accept)) s += 3
    if (mode === 'video' && /^image/i.test(accept)) s -= 3
    if (mode === 'image' && /^video/i.test(accept)) s -= 3
    scored.push({ idx: i, score: s, accept })
  }
  scored.sort((a, b) => b.score - a.score)
  const pick = scored.find(x => x.score > 0) || scored[0]
  if (!pick) return false
  await inputs[pick.idx].setInputFiles(filePath)
  return true
}

async function fillFieldByCandidates(page: Page, value: string, candidates: Array<string | RegExp>) {
  for (const pat of candidates) {
    const ph = page.getByPlaceholder(pat as any).first()
    if (await ph.count().catch(() => 0)) {
      await ph.fill(value).catch(async () => {
        await ph.click()
        await ph.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
        await ph.type(value, { delay: 8 })
      })
      return true
    }
  }
  const selector = 'textarea, [contenteditable="true"], input:not([type="file"]):not([type="hidden"])'
  const handles = await page.locator(selector).elementHandles()
  for (const h of handles) {
    const box = await h.boundingBox().catch(() => null)
    if (!box || box.width < 120 || box.height < 20) continue
    if (await h.getAttribute('disabled').catch(() => null)) continue
    await h.click().catch(() => undefined)
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A').catch(() => undefined)
    await page.keyboard.type(value, { delay: 8 }).catch(() => undefined)
    const got = await page.evaluate(el => (el as HTMLInputElement).value || el.textContent || '', h).catch(() => '')
    if (got.includes(value.slice(0, Math.min(value.length, 12)))) return true
  }
  return false
}

async function closeCoverModal(page: Page) {
  // 抖音/小红书封面上传后会弹一个「编辑封面」大弹窗，需要点「完成」把弹窗收掉，否则整个发布按钮会被 semi-modal-wrap 挡住。
  const patterns = [/^完成$/, /^保存$/, /^确定$/, /^确认$/]
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.waitForTimeout(1500)
    for (const pat of patterns) {
      const btn = page.getByRole('button', { name: pat }).first()
      if (await btn.count().catch(() => 0)) {
        const disabled = await btn.getAttribute('disabled').catch(() => null)
        if (disabled !== null) continue
        await btn.click({ timeout: 3000 }).catch(() => undefined)
        await page.waitForTimeout(1200)
        return true
      }
    }
    for (const pat of patterns) {
      const el = page.getByText(pat).first()
      if (await el.count().catch(() => 0)) {
        await el.click({ timeout: 3000 }).catch(() => undefined)
        await page.waitForTimeout(1200)
        return true
      }
    }
  }
  return false
}

async function fillDouyin(page: Page, draft: PreparedDraft, copy: PlatformCopy, result: StepResult, opts: Options) {
  // 0) 登录守卫：一进来立刻确认不是扫码页
  await assertLoggedIn(page, 'douyin')

  // 1) 等待并上传视频（只挑 accept 含 video 的 input）
  const ok = await waitForUploadSurface(page, opts.timeoutMs)
  if (!ok) { result.warnings.push('未找到上传 input（抖音）'); return }
  const videoInput = page.locator('input[type=file][accept*="video"], input[type=file][accept*="mp4"]').first()
  await videoInput.waitFor({ state: 'attached', timeout: opts.timeoutMs }).catch(() => undefined)
  await videoInput.setInputFiles(draft.videoPath).catch(() => undefined)
  result.warnings.push('视频已提交上传（抖音），等待处理...')
  // 等视频进入编辑区（出现「作品标题」/「编辑封面」/进度）
  await page.waitForSelector('input[placeholder*="标题"], input[placeholder*="作品标题"], text=编辑封面', { timeout: 180_000 }).catch(() => undefined)
  await page.waitForTimeout(3000)
  await screenshotPath(page, draft.id, 'douyin', 'after_upload').catch(() => undefined)

  // 2) 只填标题栏（input placeholder 含"标题"）
  const titleInput = page.locator('input[placeholder*="作品标题"], input[placeholder*="标题"]').first()
  const tOk = await titleInput.count().catch(() => 0)
  if (tOk) {
    await titleInput.click({ timeout: 5000 }).catch(() => undefined)
    await titleInput.fill('').catch(() => undefined)
    await titleInput.fill(copy.title).catch(async () => {
      await titleInput.click(); await page.keyboard.type(copy.title, { delay: 8 })
    })
  } else {
    result.warnings.push('未找到抖音标题输入框')
  }
  await screenshotPath(page, draft.id, 'douyin', 'after_title').catch(() => undefined)

  // 3) 只填正文栏（contenteditable 或 textarea placeholder 含"描述"）
  const descLoc = page.locator('div[contenteditable="true"], textarea').filter({ hasNot: page.locator('[placeholder*="标题"]') })
  const descCount = await descLoc.count().catch(() => 0)
  let dOk = false
  if (descCount > 0) {
    const desc = descLoc.first()
    await desc.click({ timeout: 5000 }).catch(() => undefined)
    await page.keyboard.press('Control+A').catch(() => undefined)
    await page.keyboard.press('Delete').catch(() => undefined)
    await page.keyboard.type(copy.description, { delay: 6 }).catch(() => undefined)
    // 话题：逐个 type + 空格触发下拉
    for (const tag of copy.hashtags) {
      const t = tag.startsWith('#') ? tag : `#${tag}`
      await page.keyboard.type(' ' + t, { delay: 10 }).catch(() => undefined)
      await page.waitForTimeout(600)
      await page.keyboard.type(' ').catch(() => undefined)
    }
    dOk = true
  } else {
    result.warnings.push('未找到抖音正文输入框')
  }
  await screenshotPath(page, draft.id, 'douyin', 'after_desc').catch(() => undefined)

  // 4) 封面（v13）：抖音新版 UI = 隐藏 input + React 受控组件 + 模态弹窗
  //   - 强制派发 change/input 事件，避免 React state 不更新的假成功
  //   - hover 视频区域 → 找悬浮"编辑封面"按钮 / SVG icon
  //   - 走完流程后对比缩略图 src 是否变化，作为客观校验
  const coverPath = draft.coverPathByPlatform?.douyin && existsSync(draft.coverPathByPlatform.douyin)
    ? draft.coverPathByPlatform.douyin : draft.coverPath
  let coverOk = false

  await dumpSurface(page, 'douyin_before_cover').catch(() => undefined)

  const snapshotThumbSrc = async (): Promise<string> => {
    return await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('img')) as HTMLImageElement[]
      const cand = nodes.filter(el => {
        const r = el.getBoundingClientRect()
        return r.width > 120 && r.height > 120 && (el.src || '').length > 0
      })
      cand.sort((a, b) => (b.getBoundingClientRect().width * b.getBoundingClientRect().height) - (a.getBoundingClientRect().width * a.getBoundingClientRect().height))
      return cand[0]?.src || ''
    }).catch(() => '') as any
  }
  const thumbBefore = await snapshotThumbSrc()

  const forceInjectImageInput = async (inputLocator: any, filePath: string): Promise<boolean> => {
    try {
      await inputLocator.setInputFiles(filePath)
      await page.evaluate(() => {
        document.querySelectorAll('input[type=file][accept*="image"]').forEach((el: any) => {
          try {
            el.dispatchEvent(new Event('change', { bubbles: true }))
            el.dispatchEvent(new Event('input', { bubbles: true }))
          } catch {}
        })
      }).catch(() => undefined)
      await page.waitForTimeout(2500)
      return true
    } catch { return false }
  }

  const processCoverModal = async (): Promise<boolean> => {
    for (const pat of [/^上传封面$/, /^本地上传$/, /^本地图片$/, /^自定义封面$/, /^上传$/]) {
      const tab = page.locator('.semi-modal-wrap, [role="dialog"]').getByText(pat).first()
      if (await tab.count().catch(() => 0)) {
        await tab.click({ timeout: 2000 }).catch(() => undefined)
        await page.waitForTimeout(900)
        break
      }
    }
    let modalInput = page.locator('.semi-modal-wrap input[type=file][accept*="image"], [role="dialog"] input[type=file][accept*="image"]').first()
    if (!(await modalInput.count().catch(() => 0))) {
      modalInput = page.locator('.semi-modal-wrap input[type=file], [role="dialog"] input[type=file]').first()
    }
    if (!(await modalInput.count().catch(() => 0))) return false
    const injected = await forceInjectImageInput(modalInput, coverPath)
    if (!injected) return false
    await closeCoverModal(page).catch(() => undefined)
    return true
  }

  // 路径 A：文字触发器（旧版兼容）
  try {
    const triggerLoc = page.getByText(/^选择封面$|^编辑封面$|^更换封面$|^设置封面$/).first()
    if (await triggerLoc.count().catch(() => 0)) {
      await triggerLoc.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => undefined)
      await triggerLoc.click({ timeout: 4000 }).catch(() => undefined)
      await page.waitForTimeout(1800)
      coverOk = await processCoverModal()
    }
  } catch {}

  // 路径 B：hover 视频缩略图 → 悬浮按钮（aria-label / title / class 全部尝试）
  if (!coverOk) {
    try {
      const thumb = page.locator('video, img[src*="tos"], img[class*="cover"], [class*="video-preview"]').first()
      if (await thumb.count().catch(() => 0)) {
        await thumb.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => undefined)
        await thumb.hover({ timeout: 3000 }).catch(() => undefined)
        await page.waitForTimeout(900)
        const btnCandidates = [
          page.locator('[aria-label*="封面"], [title*="封面"]').first(),
          page.locator('[class*="editCover"], [class*="edit-cover"], [class*="cover-edit"], [class*="coverEdit"]').first(),
          page.getByText(/^封面$|^编辑封面$|^选择封面$/).first(),
        ]
        for (const btn of btnCandidates) {
          if (await btn.count().catch(() => 0)) {
            await btn.click({ timeout: 3000 }).catch(() => undefined)
            await page.waitForTimeout(1600)
            if (await processCoverModal()) { coverOk = true; break }
          }
        }
      }
    } catch {}
  }

  // 路径 B2：暴力扫描含"封面/cover"关键字的可点节点
  if (!coverOk) {
    try {
      const hitRect: any = await page.evaluate(() => {
        const kws = ['封面', 'cover', 'Cover']
        const nodes = Array.from(document.querySelectorAll('button, [role="button"], svg, [class*="icon"], [class*="Icon"]')) as HTMLElement[]
        for (const el of nodes) {
          const aria = el.getAttribute('aria-label') || ''
          const title = el.getAttribute('title') || ''
          const cls = (el.className && (el.className as any).toString ? (el.className as any).toString() : (el.className as any)) || ''
          const txt = (el.textContent || '').trim()
          const hay = String(aria) + '|' + String(title) + '|' + String(cls) + '|' + String(txt)
          if (kws.some(k => hay.indexOf(k) >= 0)) {
            const r = el.getBoundingClientRect()
            if (r.width > 6 && r.height > 6 && r.width < 200 && r.height < 200) {
              return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
            }
          }
        }
        return null
      }).catch(() => null)
      if (hitRect) {
        await page.mouse.click(hitRect.x, hitRect.y).catch(() => undefined)
        await page.waitForTimeout(1800)
        coverOk = await processCoverModal()
      }
    } catch {}
  }

  // 路径 C：兜底 — 强注入 image input（含 change 事件派发）
  if (!coverOk) {
    try {
      const imgInputs = page.locator('input[type=file][accept*="image"]')
      const n = await imgInputs.count().catch(() => 0)
      for (let i = n - 1; i >= 0; i--) {
        const inj = await forceInjectImageInput(imgInputs.nth(i), coverPath)
        if (inj) {
          await closeCoverModal(page).catch(() => undefined)
          coverOk = true
          result.warnings.push(`抖音封面：走隐藏 input#${i} 兜底注入 + 手动派发 change 事件`)
          break
        }
      }
    } catch {}
  }

  await page.waitForTimeout(3000)
  const thumbAfter = await snapshotThumbSrc()
  const thumbChanged = thumbBefore !== thumbAfter && thumbAfter.length > 0
  if (coverOk && !thumbChanged) {
    result.warnings.push('抖音封面：注入完成但缩略图 src 未变化，请人工核对；如需要可手动点封面')
  }

  await dumpSurface(page, 'douyin_after_cover').catch(() => undefined)
  if (!coverOk) result.warnings.push('未能自动上传横版封面（抖音），请手动选择')
  await screenshotPath(page, draft.id, 'douyin', 'after_cover').catch(() => undefined)

  result.filled = !!tOk && dOk && coverOk
}


// __V9_DUMP__ start
const V9_DUMP_SRC = String.raw`
(function(){
  function describe(el){
    var r = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
    return {tag:el.tagName,id:el.id||null,cls:(el.className&&el.className.toString?el.className.toString():el.className)||null,accept:el.accept||null,type:el.type||null,ce:el.getAttribute?el.getAttribute("contenteditable"):null,ph:el.getAttribute?(el.getAttribute("placeholder")||el.getAttribute("data-placeholder")):null,role:el.getAttribute?el.getAttribute("role"):null,visible:el.offsetParent!==null,rect:r?{x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)}:null,html:(el.outerHTML||"").slice(0,300)};
  }
  var seen=[];
  function walk(root){try{var it=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT);var n=it.currentNode;while(n){if(n.shadowRoot)walk(n.shadowRoot);if(n.tagName==="INPUT"&&n.type==="file")seen.push(n);n=it.nextNode();}}catch(e){}}
  walk(document);
  var editors=[];
  var editorSel='div[contenteditable="true"], [role="textbox"], .ql-editor, [class*="ql-editor"], textarea, [data-placeholder]';
  var eNodes=document.querySelectorAll(editorSel);
  for(var i=0;i<eNodes.length && editors.length<40;i++){editors.push(describe(eNodes[i]));}
  var kws=["\u4e0a\u4f20\u89c6\u9891","\u4e0a\u4f20\u5c01\u9762","\u53d1\u5e03\u7b14\u8bb0","\u53d1\u5e03\u89c6\u9891","\u4f5c\u54c1\u6807\u9898","\u6807\u9898","\u62d6\u62fd","\u70b9\u51fb\u4e0a\u4f20","\u6dfb\u52a0\u89c6\u9891","\u6dfb\u52a0\u5c01\u9762","\u586b\u5199\u4f5c\u54c1\u4fe1\u606f","\u89c6\u9891\u63cf\u8ff0","\u6b63\u6587","\u63cf\u8ff0","\u8bdd\u9898","\u4e0a\u4f20\u56fe\u6587","\u53d1\u5e03","\u9009\u62e9\u5c01\u9762","\u7f16\u8f91\u5c01\u9762","\u66f4\u6362\u5c01\u9762","\u5c01\u9762","\u63a8\u8350\u6807\u9898","\u6dfb\u52a0\u8bdd\u9898"];
  var hits=[];
  var nodes=document.querySelectorAll("button,div,span,a,label,section,p");
  for(var j=0;j<nodes.length;j++){var el=nodes[j];var t=(el.innerText||"").trim();if(!t||t.length>40)continue;for(var k=0;k<kws.length;k++){if(t===kws[k]||t.indexOf(kws[k])>=0){var r=el.getBoundingClientRect();if(r.width>4&&r.height>4)hits.push({text:t,tag:el.tagName,cls:((el.className&&el.className.toString?el.className.toString():el.className)||"").slice(0,80),rect:{x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)}});break;}}}
  return {url:location.href,title:document.title,inputs:seen.map(describe),editors:editors,textHits:hits.slice(0,140)};
})()
`;
async function dumpSurface(page, tag) {
  try {
    const out = { tag, mainUrl: page.url(), frames: [] };
    for (const f of page.frames()) {
      const d = await f.evaluate(V9_DUMP_SRC).catch((e) => ({ error: String(e) }));
      d.frameUrl = f.url();
      out.frames.push(d);
    }
    ensureDir(LOG_DIR);
    const fp = join(LOG_DIR, "xhs_dump_" + tag + "_" + Date.now() + ".json");
    writeFileSync(fp, JSON.stringify(out, null, 2), "utf8");
    return fp;
  } catch (e) { return null; }
}
// __V9_DUMP__ end

async function fillXiaohongshu(page: Page, draft: PreparedDraft, copy: PlatformCopy, result: StepResult, opts: Options) {
  // 0) 登录守卫
  await assertLoggedIn(page, 'xiaohongshu')

  // 1) 切到"上传视频"tab
  await clickTextIfPresent(page, [/^上传视频$/])
  await page.waitForTimeout(1800)

  // 2) 上传视频（新版 UI 上 accept 属性可能为空/不同，全 input 兜底）
  const ok = await waitForUploadSurface(page, opts.timeoutMs)
  if (!ok) { result.warnings.push('未找到上传 input（小红书）'); return }

  let videoUploaded = false
  // 优先带 accept=video 的 input
  const videoInputPri = page.locator('input[type=file][accept*="video"], input[type=file][accept*="mp4"], input.upload-input, input[type=file][accept*=".mov"]').first()
  if (await videoInputPri.count().catch(() => 0)) {
    await videoInputPri.waitFor({ state: 'attached', timeout: opts.timeoutMs }).catch(() => undefined)
    try {
      const __v9_wait_upload = page.waitForResponse(function(r){var u=r.url();return (u.indexOf('upload')>=0||u.indexOf('creator')>=0||u.indexOf('video')>=0)&&r.status()<400;}, { timeout: 60_000 }).catch(function(){return null;});
      await videoInputPri.setInputFiles(draft.videoPath);
      // __V9_DISPATCH__ 主动派发 change/input，兜住框架未监听 setInputFiles 的情况
      await page.evaluate("document.querySelectorAll('input[type=file]').forEach(function(i){try{i.dispatchEvent(new Event('change',{bubbles:true}));i.dispatchEvent(new Event('input',{bubbles:true}));}catch(e){}})").catch(function(){});
      await __v9_wait_upload;
      videoUploaded = true
    } catch {}
  }
  // 兜底：所有 input[type=file] 全试一遍
  if (!videoUploaded) {
    const allInputs = page.locator('input[type=file]')
    const n = await allInputs.count().catch(() => 0)
    for (let i = 0; i < n; i++) {
      try {
        await allInputs.nth(i).setInputFiles(draft.videoPath)
        // 观察 10s 内是否出现标题框（表示上传成功进入编辑区）
        const entered = await page.waitForSelector('input[placeholder*="标题"]', { timeout: 30_000 }).then(() => true).catch(() => false)
        if (entered) { videoUploaded = true; break }
      } catch {}
    }
  }
  if (!videoUploaded) {
    result.warnings.push('小红书视频上传疑似静默失败，请人工核对')
  }
  // 等到标题输入框出现（表示进入编辑区）
  // __V9_PRE_TITLE__ dump DOM + 尝试 tab 兜底
  await dumpSurface(page, 'before_title_wait').catch(function(){});
  {
    const __v9_titleCount0 = await page.locator('input[placeholder*="标题"]').count().catch(function(){return 0;});
    if (__v9_titleCount0 === 0) {
      await clickTextIfPresent(page, [/^上传视频$/, /^发布视频$/, /^添加视频$/]);
      await page.waitForTimeout(2000);
      await page.evaluate("document.querySelectorAll('input[type=file]').forEach(function(i){try{i.dispatchEvent(new Event('change',{bubbles:true}));i.dispatchEvent(new Event('input',{bubbles:true}));}catch(e){}})").catch(function(){});
      await page.waitForTimeout(2000);
      await dumpSurface(page, 'before_title_wait_after_tab').catch(function(){});
    }
  }
  await page.waitForSelector('input[placeholder*="标题"]', { timeout: 240_000 }).catch(() => undefined)
  await page.waitForTimeout(3000)
  await screenshotPath(page, draft.id, 'xiaohongshu', 'after_upload').catch(() => undefined)

  // 3) 只填标题栏（<= 20 字，XHS 上限）
  const titleInput = page.locator('input[placeholder*="标题"]').first()
  const titleValue = (copy.title || '').slice(0, 20)
  let tOk = false
  if (await titleInput.count().catch(() => 0)) {
    await titleInput.click({ timeout: 5000 }).catch(() => undefined)
    await titleInput.fill('').catch(() => undefined)
    await titleInput.fill(titleValue).catch(async () => {
      await titleInput.click(); await page.keyboard.type(titleValue, { delay: 8 })
    })
    tOk = true
  } else {
    result.warnings.push('未找到小红书标题输入框')
  }
  await screenshotPath(page, draft.id, 'xiaohongshu', 'after_title').catch(() => undefined)
  await dumpSurface(page, 'after_title_editors').catch(function(){});


  // 4) 只填正文栏（多 selector 兜底：.ql-editor / contenteditable / [role=textbox] / [data-placeholder] / textarea；避开标题）
  const XHS_DESC_SEL = '.ql-editor, div[contenteditable="true"], [role="textbox"], [data-placeholder]:not(input), textarea'
  const descLoc = page.locator(XHS_DESC_SEL).filter({ hasNot: page.locator('[placeholder*="标题"], input[placeholder*="标题"]') })
  let dOk = false
  if (await descLoc.count().catch(() => 0) > 0) {
    const desc = descLoc.first()
    await desc.click({ timeout: 5000 }).catch(() => undefined)
    await page.keyboard.press('Control+A').catch(() => undefined)
    await page.keyboard.press('Delete').catch(() => undefined)
    await page.keyboard.type(copy.description, { delay: 6 }).catch(() => undefined)
    // 话题：# → 等下拉 → Enter 选中
    for (const tag of copy.hashtags) {
      const clean = tag.replace(/^#/, '')
      await page.keyboard.type(' #' + clean, { delay: 20 }).catch(() => undefined)
      await page.waitForTimeout(900)
      await page.keyboard.press('Enter').catch(() => undefined)
      await page.waitForTimeout(300)
    }
    dOk = true
  } else {
    result.warnings.push('未找到小红书正文输入框')
  }
  await screenshotPath(page, draft.id, 'xiaohongshu', 'after_desc').catch(() => undefined)

  // 5) 竖版封面
  const coverPath = draft.coverPathByPlatform?.xiaohongshu && existsSync(draft.coverPathByPlatform.xiaohongshu)
    ? draft.coverPathByPlatform.xiaohongshu : draft.coverPath
  let coverOk = false
  try {
    const trigger = page.getByText(/^上传封面$|^更换封面$|^编辑封面$|^选择封面$|^添加封面$|^封面$/).first()
    if (await trigger.count().catch(() => 0)) {
      await trigger.click({ timeout: 4000 }).catch(() => undefined)
      await page.waitForTimeout(1500)
      const modalInput = page.locator('input[type=file][accept*="image"]').last()
      if (await modalInput.count().catch(() => 0)) {
        await modalInput.setInputFiles(coverPath).catch(() => undefined)
        coverOk = true
        await page.waitForTimeout(3000)
      }
      await closeCoverModal(page).catch(() => undefined)
    }
  } catch {}
  if (!coverOk) result.warnings.push('未能自动上传竖版封面（小红书），请手动选择')
  await screenshotPath(page, draft.id, 'xiaohongshu', 'after_cover').catch(() => undefined)

  result.filled = tOk && dOk && coverOk
}

async function screenshotPath(page: Page, draftId: string, platform: Platform, tag: string) {
  ensureDir(SCREENSHOT_DIR)
  const p = join(SCREENSHOT_DIR, `${draftId}_${platform}_${tag}.png`)
  await page.screenshot({ path: p, fullPage: true }).catch(async () => { await page.screenshot({ path: p }) })
  return p
}

async function clickPublish(page: Page, platform: Platform): Promise<{ ok: boolean; note: string }> {
  const patterns: RegExp[] = platform === 'douyin'
    ? [/^发布$/, /^立即发布$/, /^发布视频$/, /^发布作品$/]
    : [/^发布$/, /^发布笔记$/]
  for (const pat of patterns) {
    const btn = page.getByRole('button', { name: pat }).first()
    if (await btn.count().catch(() => 0)) {
      const disabled = await btn.getAttribute('disabled').catch(() => null)
      if (disabled !== null) return { ok: false, note: `按钮存在但被禁用（disabled）` }
      try { await btn.scrollIntoViewIfNeeded({ timeout: 3000 }) } catch {}
      try { await btn.click({ timeout: 5000 }) }
      catch { await btn.click({ force: true, timeout: 5000 }).catch(() => undefined) }
      await page.waitForTimeout(1500)
      const modalConfirm = page.locator('.semi-modal-wrap button:has-text("确认"), .semi-modal-wrap button:has-text("确定"), .semi-modal-wrap button:has-text("发布")').first()
      if (await modalConfirm.count().catch(() => 0)) {
        await modalConfirm.click({ timeout: 5000 }).catch(() => undefined)
        await page.waitForTimeout(2500)
      }
      await page.waitForTimeout(2000)
      return { ok: true, note: `已点击按钮：${pat}` }
    }
  }
  for (const pat of patterns) {
    const el = page.getByText(pat).first()
    if (await el.count().catch(() => 0)) {
      try { await el.scrollIntoViewIfNeeded({ timeout: 3000 }) } catch {}
      await el.click({ timeout: 5000 }).catch(() => undefined)
      await page.waitForTimeout(3500)
      return { ok: true, note: `已点击文本：${pat}` }
    }
  }
  return { ok: false, note: '未找到发布按钮，请人工点击' }
}

async function askYes(question: string, autoConfirm: boolean): Promise<boolean> {
  if (autoConfirm) { console.log(`${question} (自动 --yes)`); return true }
  const rl = createInterface({ input, output })
  try {
    const ans = (await rl.question(question)).trim().toLowerCase()
    return ans === 'y' || ans === 'yes'
  } finally { rl.close() }
}

async function main() {
  const opts = parseArgs()
  const draft = loadDraft(opts)
  ensureDir(LOG_DIR); ensureDir(SCREENSHOT_DIR)

  console.log(`\n=== MBTI-PRO · 一键发布 ===`)
  console.log(`草稿: ${draft.id}`)
  console.log(`视频: ${draft.videoPath}`)
  console.log(`平台: ${opts.platforms.join(', ')}`)
  console.log(`Chrome profile: ${opts.profileDir}\n`)

  const context = await launchPersistent(opts)
  const results: StepResult[] = []
  const preparedPages: Array<{ platform: Platform; page: Page; result: StepResult; copy: PlatformCopy }> = []

  try {
    for (const platform of opts.platforms) {
      const copy = draft.copies.find(c => c.platform === platform)
      const result: StepResult = { platform, filled: false, loginRequired: false, publishClicked: false, warnings: [], errors: [] }
      results.push(result)
      if (!copy) { result.errors.push('草稿缺失该平台文案'); continue }

      // 登录探测（首次会弹出扫码登录）
      try {
        await waitForLoginIfNeeded(context, platform, opts, result)
      } catch (e) {
        result.errors.push(String(e))
        continue
      }

      // 打开上传页开始填表
      try {
        const page = await openPage(context, copy.publishUrl)
        try {
          if (platform === 'douyin') await fillDouyin(page, draft, copy, result, opts)
          else await fillXiaohongshu(page, draft, copy, result, opts)
        } catch (e) {
          result.errors.push(`填表异常：${String(e)}`)
        }

        result.screenshotFilled = await screenshotPath(page, draft.id, platform, 'filled').catch(() => undefined)
        console.log(`\n── ${platform} · 填表完成 ──`)
        console.log(`  截图: ${result.screenshotFilled}`)
        console.log(`  标题: ${copy.title}`)
        console.log(`  警告: ${result.warnings.length ? result.warnings.join('；') : '无'}`)

        preparedPages.push({ platform, page, result, copy })

        if (opts.prepareOnly) {
          console.log(`  ⏸ [${platform}] prepare-only 模式，页面已填好，保留标签供你手动点「发布」。`)
          continue
        }

        const yes = await askYes(`是否点击 ${platform} 的“发布”按钮？(y/N) `, opts.autoConfirm)
        if (!yes) { console.log('  ↷ 跳过（未点击发布，页面保留供人工检查）'); continue }

        const click = await clickPublish(page, platform)
        result.publishClicked = click.ok
        result.confirmedAt = new Date().toISOString()
        result.screenshotAfter = await screenshotPath(page, draft.id, platform, 'after_publish').catch(() => undefined)
        console.log(`  ${click.ok ? '✓' : '✗'} ${click.note}`)
        console.log(`  发布后截图: ${result.screenshotAfter}`)
        await sleep(2000)
      } catch (e) {
        result.errors.push(`平台流程异常：${String(e)}`)
        console.log(`  ⚠ [${platform}] 出错，已跳过：${String(e)}`)
      }
    }

    if (opts.prepareOnly && preparedPages.length) {
      console.log('\n============================================================')
      console.log('🟢 所有平台已填写完毕，浏览器保持打开。')
      console.log('   请人工在浏览器里核对每个标签页：')
      preparedPages.forEach(p => console.log(`     · [${p.platform}] 标题=${p.copy.title}`))
      console.log('   核对无误后，逐个手动点「发布」按钮。')
      console.log('   全部发布完成后，在此处输入 done 回车让脚本收尾（会补截图 + 写日志）。')
      console.log('============================================================\n')
      const rl2 = createInterface({ input, output })
      try { await rl2.question('输入 done 结束：') } finally { rl2.close() }
      for (const p of preparedPages) {
        p.result.screenshotAfter = await screenshotPath(p.page, draft.id, p.platform, 'after_publish').catch(() => undefined)
        p.result.publishClicked = true
        p.result.confirmedAt = new Date().toISOString()
      }
    }
  } finally {
    // 不主动关闭 context，保留登录态到 profileDir；进程退出时浏览器随之关闭。
    try { await context.close() } catch {}
  }

  const logPath = join(LOG_DIR, `${draft.id}.one-click.json`)
  writeFileSync(logPath, JSON.stringify({ draftId: draft.id, runAt: new Date().toISOString(), results }, null, 2), 'utf-8')
  console.log(`\n✅ 一键发布结束，日志: ${logPath}`)
}

main().catch(e => { console.error(e); process.exit(1) })