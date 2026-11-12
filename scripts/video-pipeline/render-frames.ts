// ============================================================
// MBTI-PRO Video Pipeline 鈥?Playwright 瑙嗛娓叉煋寮曟搸
// 鏀寔涓ょ妯″紡:
//   1. 褰曞睆妯″紡 (renderVideo): Playwright 鍐呯疆褰曞睆锛孋SS鍔ㄧ敾瀹岀編鎹曡幏
//   2. 鎴浘妯″紡 (renderFrames): 鍏抽敭甯ф埅鍥?鈫?FFmpeg 鍚堟垚
// ============================================================

import { chromium } from 'playwright'
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { createRequire } from 'node:module'
import type { FrameRenderConfig, PersonalityTypeData } from './types.js'
import { getTypeColor, getNineGroupCode } from './utils/colors.js'

const TEMPLATES_DIR = resolve(import.meta.dirname, 'templates')
const PROJECT_ROOT = resolve(import.meta.dirname, '..', '..')
const LOCAL_IMAGE_DIR = join(PROJECT_ROOT, 'video', '81_image')
const QR_URL = 'https://mbti-pro.com/?utm_source=douyin&utm_medium=video&utm_campaign=personality_daily'
const requireFromClient = createRequire(join(PROJECT_ROOT, 'client', 'package.json'))
let QRCode: any
try { QRCode = requireFromClient('qrcode') } catch {}

function imageToDataUrl(filePath: string): string {
  if (!existsSync(filePath)) return ''
  const ext = filePath.toLowerCase().endsWith('.webp') ? 'webp' : 'jpeg'
  return `data:image/${ext};base64,${readFileSync(filePath).toString('base64')}`
}

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`
}

function buildQrSvg(url: string): string {
  if (!QRCode) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="210" height="210" viewBox="0 0 210 210"><rect width="100%" height="100%" fill="#fff"/><text x="50%" y="50%" text-anchor="middle" font-family="Arial" font-size="18" font-weight="700" fill="#2F261B">mbti-pro.com</text></svg>'
  }
  const qr = QRCode.create(url, { errorCorrectionLevel: 'M' })
  const modules = qr.modules.size
  const margin = 4
  const cell = 8
  const size = (modules + margin * 2) * cell
  const rects: string[] = []
  for (let y = 0; y < modules; y++) {
    for (let x = 0; x < modules; x++) {
      if (qr.modules.get(x, y)) {
        rects.push(`<rect x="${(x + margin) * cell}" y="${(y + margin) * cell}" width="${cell}" height="${cell}"/>`)
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="100%" height="100%" fill="#fff"/><g fill="#2F261B">${rects.join('')}</g></svg>`
}

/**
 * 灏?HTML 妯℃澘鍐欏叆涓存椂鏂囦欢锛堣В鍐?data: URI 鐨?CORS 闄愬埗锛? * file:// 鍗忚鍙嚜鐢卞姞杞?localhost 鍥剧墖璧勬簮
 */
function writeTempHtml(html: string, workDir: string): string {
  if (!existsSync(workDir)) mkdirSync(workDir, { recursive: true })
  const filePath = join(workDir, '_template.html')
  writeFileSync(filePath, html, 'utf-8')
  return filePath
}

/**
 * 鍔犺浇 HTML 妯℃澘鏂囦欢
 */
function loadTemplate(name: string): string {
  const filePath = join(TEMPLATES_DIR, `${name}.html`)
  if (!existsSync(filePath)) {
    throw new Error(`妯℃澘鏂囦欢涓嶅瓨鍦? ${filePath}`)
  }
  return readFileSync(filePath, 'utf-8')
}

/**
 * 鏋勫缓娉ㄥ叆鍒版祻瑙堝櫒椤甸潰鐨勬暟鎹璞? */
export function buildInjectData(typeData: PersonalityTypeData) {
  const colorInfo = getTypeColor(typeData.code)
  const groupCode = getNineGroupCode(typeData.code)

  // 浠?overview 鎻愬彇缁村害瀛楃
  const chars = {
    E_I: typeData.code[0] as 'E' | 'A' | 'I',
    S_N: typeData.code[1] as 'N' | 'B' | 'S',
    T_F: typeData.code[2] as 'T' | 'C' | 'F',
    P_J: typeData.code[3] as 'J' | 'D' | 'P',
  }

  return {
    code: typeData.code,
    name: typeData.name,
    overview: typeData.overview,
    celebrities: typeData.celebrities ?? [],
    strengths: typeData.strengths ?? [],
    growthAreas: typeData.growthAreas ?? [],
    careers: typeData.careers ?? [],
    isTraditional: typeData.isTraditional,
    population: typeData.population ?? '',
    imageDataUrl: imageToDataUrl(join(LOCAL_IMAGE_DIR, `${typeData.code}.jpg`)),
    imageUrl: imageToDataUrl(join(LOCAL_IMAGE_DIR, `${typeData.code}.jpg`)),
    fallbackImageUrl: `http://localhost:3001/api/images/${typeData.code}`,
    qrDataUrl: svgToDataUrl(buildQrSvg(QR_URL)),
    marketing: (typeData as any).marketing ?? {},
    chars,
    // 棰滆壊淇℃伅
    _colorHex: colorInfo.hex,
    _colorTextHex: colorInfo.text,
    _groupCode: groupCode,
    _groupName: colorInfo.name,
    // 缁村害妯″潡
    eiModule: typeData.eiModule ?? '',
    snModule: typeData.snModule ?? '',
    tfModule: typeData.tfModule ?? '',
    pjModule: typeData.pjModule ?? '',
  }
}

/**
 * 娓叉煋瑙嗛甯у簭鍒? * 浣跨敤鍏抽敭甯х瓥鐣?+ FFmpeg 琛ラ棿锛氬彧鎴彇鍏抽敭鏃堕棿鐐圭殑甯? */
export async function renderFrames(
  config: FrameRenderConfig,
  typeData: PersonalityTypeData,
  templateHtml?: string,
): Promise<string[]> {
  const {
    typeCode,
    outputDir,
    width = 1080,
    height = 1920,
    durationSeconds = 30,
    keyframeInterval = 3,
  } = config

  // 纭繚杈撳嚭鐩綍瀛樺湪
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true })
  }

  const templateName = config.template || 'daily-type'
  const html = templateHtml ?? loadTemplate(templateName)
  const injectData = buildInjectData(typeData)

  console.log(`[render] 鍚姩 Chromium...`)
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2, // 2x 瓒呴噰鏍凤紝纭繚鏂囧瓧娓呮櫚
  })
  const page = await context.newPage()

  // 加载模板（写入临时文件，file:// 协议避免 CORS）
  const htmlPath = writeTempHtml(html, outputDir)
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' })

  // 娉ㄥ叆鏁版嵁
  await page.evaluate((data) => {
    (window as any).typeData = data
    // 閲嶆柊瑙﹀彂濉厖
    const fillFn = (window as any).__refill
    if (typeof fillFn === 'function') fillFn(data)
  }, injectData)

  // 等待字体和图片加载
  await page.waitForTimeout(500)
  await page.waitForFunction(() => {
    const img = document.getElementById('typeImage') as HTMLImageElement | null
    return !img || (img.complete && img.naturalWidth > 0)
  }, undefined, { timeout: 5000 }).catch(() => {
    console.warn('[render] 人格图片未确认加载完成，将继续渲染')
  })


  const frames: string[] = []
  const keyframeTimes: number[] = []

  // 鐢熸垚鍏抽敭甯ф椂闂寸偣鍒楄〃
  for (let t = 0; t <= durationSeconds; t += keyframeInterval) {
    keyframeTimes.push(t)
  }
  // 纭繚鏈€鍚庝竴甯ц鎴彇
  if (keyframeTimes[keyframeTimes.length - 1] < durationSeconds) {
    keyframeTimes.push(durationSeconds)
  }

  console.log(`[render] 鎴彇 ${keyframeTimes.length} 涓叧閿抚 (${keyframeTimes.join(', ')}s)`)

  for (let i = 0; i < keyframeTimes.length; i++) {
    const t = keyframeTimes[i]
    const frameNum = Math.round(t * 30) // 30fps

    // 蹇繘 CSS 鍔ㄧ敾鍒版寚瀹氭椂闂寸偣
    await page.evaluate((time) => {
      // 璁剧疆鎵€鏈夊姩鐢荤殑璐熷欢杩熸潵蹇繘
      const allElements = document.querySelectorAll('*')
      allElements.forEach((el) => {
        const style = (el as HTMLElement).style
        // 只处理有动画的元素
        const animName = getComputedStyle(el).animationName
        if (animName && animName !== 'none') {
          style.animationDelay = `-${time}s`
        }
      })
    }, t)

    // 绛夊緟娓叉煋绋冲畾
    await page.waitForTimeout(100)

    const framePath = join(outputDir, `frame_${String(frameNum).padStart(4, '0')}.png`)
    await page.screenshot({ path: framePath, type: 'png' })
    frames.push(framePath)

    if (i % 3 === 0 || i === keyframeTimes.length - 1) {
      console.log(`[render]  甯?${frameNum} (${t}s) 鈫?${framePath}`)
    }
  }

  await browser.close()
  console.log(`[render] 鉁?瀹屾垚: ${frames.length} 甯?鈫?${outputDir}`)
  return frames
}

/**
 * 浠呮覆鏌撳崟甯э紙鐢ㄤ簬灏侀潰鍥俱€侀瑙堢瓑锛? */
function clearFrameSequence(outputDir: string) {
  if (!existsSync(outputDir)) return
  for (const file of readdirSync(outputDir)) {
    if (/^frame_\d+\.png$/.test(file)) {
      try { unlinkSync(join(outputDir, file)) } catch {}
    }
  }
}

async function waitForTemplateImages(page: any, label: string) {
  await page.evaluate(() => (document as any).fonts?.ready).catch(() => {})
  await page.waitForFunction(() => {
    const ids = ['typeImage', 'cornerQr', 'endQr']
    return ids.every((id) => {
      const img = document.getElementById(id) as HTMLImageElement | null
      if (!img) return true
      const src = img.getAttribute('src') || ''
      return !src || (img.complete && img.naturalWidth > 0)
    })
  }, undefined, { timeout: 10000 }).catch(() => {
    console.warn(`[render:frames] ${label} 图片/二维码未全部确认加载，将继续渲染`)
  })
}

/**
 * 逐帧渲染完整视频帧序列。
 * 用于 2K/高清终版：避免 Playwright WebM 录屏低码率导致的模糊。
 */
export async function renderFullFrameSequence(
  config: FrameRenderConfig,
  typeData: PersonalityTypeData,
  templateHtml?: string,
): Promise<string[]> {
  const {
    typeCode,
    outputDir,
    width = 1440,
    height = 2560,
    fps = 30,
    durationSeconds = 30,
  } = config

  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true })
  clearFrameSequence(outputDir)

  const sourceWidth = 1080
  const sourceHeight = 1920
  const scale = width / sourceWidth
  if (Math.abs(height / sourceHeight - scale) > 0.01) {
    throw new Error(`逐帧渲染仅支持 9:16 等比输出，收到 ${width}x${height}`)
  }

  const templateName = config.template || 'daily-type'
  const html = templateHtml ?? loadTemplate(templateName)
  const injectData = buildInjectData(typeData)
  const totalFrames = Math.ceil(durationSeconds * fps)

  console.log(`[render:frames] 启动 Chromium 逐帧渲染：${typeCode} ${width}x${height} @ ${fps}fps，共 ${totalFrames} 帧`)
  const browser = await chromium.launch({ headless: true })
  try {
    const context = await browser.newContext({
      viewport: { width: sourceWidth, height: sourceHeight },
      deviceScaleFactor: scale,
    })
    const page = await context.newPage()
    const htmlPath = writeTempHtml(html, outputDir)
    await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' })
    await page.evaluate((data) => {
      ;(window as any).typeData = data
      const fillFn = (window as any).__refill
      if (typeof fillFn === 'function') fillFn(data)
    }, injectData)
    await waitForTemplateImages(page, typeCode)

    const frames: string[] = []
    for (let index = 0; index < totalFrames; index += 1) {
      const timeSeconds = index / fps
      await page.evaluate((time) => {
        const animations = document.getAnimations()
        for (const animation of animations) animation.currentTime = time * 1000
      }, timeSeconds)
      const framePath = join(outputDir, `frame_${String(index + 1).padStart(5, '0')}.png`)
      await page.screenshot({ path: framePath, type: 'png', fullPage: false })
      frames.push(framePath)
      if ((index + 1) % 150 === 0 || index + 1 === totalFrames) {
        console.log(`[render:frames]  ${index + 1}/${totalFrames}`)
      }
    }

    await context.close()
    console.log(`[render:frames] ✅ 完成：${frames.length} 帧 → ${outputDir}`)
    return frames
  } finally {
    await browser.close()
  }
}
export async function renderSingleFrame(
  templateName: string,
  typeData: PersonalityTypeData,
  outputPath: string,
  timeSeconds: number = 0,
  width: number = 1080,
  height: number = 1920,
): Promise<string> {
  const html = loadTemplate(templateName)
  const injectData = buildInjectData(typeData)

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
  })
  const page = await context.newPage()

  // 写入临时文件并加载（file:// 协议避免 CORS）
  const htmlDir = dirname(outputPath)
  const htmlPath = writeTempHtml(html, htmlDir)
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' })

  await page.evaluate((data) => {
    (window as any).typeData = data
    const fillFn = (window as any).__refill
    if (typeof fillFn === 'function') fillFn(data)
  }, injectData)

  // 快进到指定时间
  await page.evaluate((time) => {
    const allElements = document.querySelectorAll('*')
    allElements.forEach((el) => {
      const animName = getComputedStyle(el).animationName
      if (animName && animName !== 'none') {
        (el as HTMLElement).style.animationDelay = `-${time}s`
      }
    })
  }, timeSeconds)

  await page.waitForTimeout(500)
  await page.screenshot({ path: outputPath, type: 'png' })
  await browser.close()

  console.log(`[render] 鍗曞抚: ${outputPath}`)
  return outputPath
}

/**
 * 浣跨敤 Playwright 鍐呯疆褰曞睆鍔熻兘鐢熸垚瑙嗛锛堟帹鑽愭ā寮忥級
 * 浼樺娍锛欳SS 鍔ㄧ敾瀹岀編鎹曡幏銆侀煶棰戞敮鎸併€佸疄鏃跺抚鐜? * 杈撳嚭锛歐ebM 鏍煎紡锛堝彲鍚庣画 FFmpeg 杞?MP4锛? */
export async function renderVideo(
  config: FrameRenderConfig,
  typeData: PersonalityTypeData,
  templateHtml?: string,
): Promise<string> {
  const {
    typeCode,
    outputDir,
    width = 1080,
    height = 1920,
    durationSeconds = 30,
  } = config

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true })
  }

  const templateName = config.template || 'daily-type'
  const html = templateHtml ?? loadTemplate(templateName)
  const injectData = buildInjectData(typeData)

  console.log(`[render:video] 鍚姩 Chromium (褰曞睆妯″紡)...`)

  // 清理旧 WebM 文件，避免重名冲突
  const { readdirSync: rd, unlinkSync, renameSync } = await import('node:fs')
  const oldFiles = rd(outputDir).filter(f => f.endsWith('.webm'))
  for (const f of oldFiles) {
    try { unlinkSync(join(outputDir, f)) } catch {}
  }

  const browser = await chromium.launch({ headless: true })

  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1, // 褰曞睆妯″紡鐢?1x 纭繚鎬ц兘
    recordVideo: {
      dir: outputDir,
      size: { width, height },
    },
  })

  const page = await context.newPage()

  // 写入临时文件并加载（file:// 协议避免 CORS）
  const htmlPath = writeTempHtml(html, outputDir)
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' })

  // 娉ㄥ叆鏁版嵁
  await page.evaluate((data) => {
    (window as any).typeData = data
    const fillFn = (window as any).__refill
    if (typeof fillFn === 'function') fillFn(data)
  }, injectData)

  await page.waitForFunction(() => {
    const img = document.getElementById('typeImage') as HTMLImageElement | null
    return !img || (img.complete && img.naturalWidth > 0)
  }, undefined, { timeout: 5000 }).catch(() => {
    console.warn('[render:video] 人格图片未确认加载完成，将继续录制')
  })

  // 绛夊緟 CSS 鍔ㄧ敾鎾斁
  console.log(`[render:video] 褰曞埗涓?.. ${durationSeconds}s`)
  await page.waitForTimeout(durationSeconds * 1000)

  // 鍏抽棴椤甸潰浠ヤ繚瀛樿棰?  await page.close()
  await context.close()
  await browser.close()

  // Playwright 鐢熸垚鐨勮棰戞枃浠跺悕鏄殢鏈虹殑锛屾壘鍒板苟閲嶅懡鍚嶅畠
  const files = rd(outputDir).filter(f => f.endsWith('.webm'))
  if (files.length === 0) {
    throw new Error('褰曞睆澶辫触锛氭湭鐢熸垚 .webm 鏂囦欢')
  }

  const sourcePath = join(outputDir, files[0])
  const targetPath = join(outputDir, `${typeCode}_raw.webm`)
  renameSync(sourcePath, targetPath)

  console.log(`[render:video] 鉁?褰曞睆瀹屾垚: ${targetPath}`)
  return targetPath
}



