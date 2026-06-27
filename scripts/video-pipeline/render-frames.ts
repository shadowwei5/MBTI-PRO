// ============================================================
// MBTI-PRO Video Pipeline — Playwright 视频渲染引擎
// 支持两种模式:
//   1. 录屏模式 (renderVideo): Playwright 内置录屏，CSS动画完美捕获
//   2. 截图模式 (renderFrames): 关键帧截图 → FFmpeg 合成
// ============================================================

import { chromium } from 'playwright'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import type { FrameRenderConfig, PersonalityTypeData } from './types.js'
import { getTypeColor, getNineGroupCode } from './utils/colors.js'

const TEMPLATES_DIR = resolve(import.meta.dirname, 'templates')

/**
 * 将 HTML 模板写入临时文件（解决 data: URI 的 CORS 限制）
 * file:// 协议可自由加载 localhost 图片资源
 */
function writeTempHtml(html: string, workDir: string): string {
  if (!existsSync(workDir)) mkdirSync(workDir, { recursive: true })
  const filePath = join(workDir, '_template.html')
  writeFileSync(filePath, html, 'utf-8')
  return filePath
}

/**
 * 加载 HTML 模板文件
 */
function loadTemplate(name: string): string {
  const filePath = join(TEMPLATES_DIR, `${name}.html`)
  if (!existsSync(filePath)) {
    throw new Error(`模板文件不存在: ${filePath}`)
  }
  return readFileSync(filePath, 'utf-8')
}

/**
 * 构建注入到浏览器页面的数据对象
 */
function buildInjectData(typeData: PersonalityTypeData) {
  const colorInfo = getTypeColor(typeData.code)
  const groupCode = getNineGroupCode(typeData.code)

  // 从 overview 提取维度字符
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
    chars,
    // 颜色信息
    _colorHex: colorInfo.hex,
    _colorTextHex: colorInfo.text,
    _groupCode: groupCode,
    _groupName: colorInfo.name,
    // 维度模块
    eiModule: typeData.eiModule ?? '',
    snModule: typeData.snModule ?? '',
    tfModule: typeData.tfModule ?? '',
    pjModule: typeData.pjModule ?? '',
  }
}

/**
 * 渲染视频帧序列
 * 使用关键帧策略 + FFmpeg 补间：只截取关键时间点的帧
 */
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

  // 确保输出目录存在
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true })
  }

  const templateName = config.template || 'daily-type'
  const html = templateHtml ?? loadTemplate(templateName)
  const injectData = buildInjectData(typeData)

  console.log(`[render] 启动 Chromium...`)
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2, // 2x 超采样，确保文字清晰
  })
  const page = await context.newPage()

  // 加载模板（写入临时文件，file:// 协议避免 CORS）
  const htmlPath = writeTempHtml(html, outputDir)
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' })

  // 注入数据
  await page.evaluate((data) => {
    (window as any).typeData = data
    // 重新触发填充
    const fillFn = (window as any).__refill
    if (typeof fillFn === 'function') fillFn(data)
  }, injectData)

  // 等待字体和图片加载
  await page.waitForTimeout(1500)

  const frames: string[] = []
  const keyframeTimes: number[] = []

  // 生成关键帧时间点列表
  for (let t = 0; t <= durationSeconds; t += keyframeInterval) {
    keyframeTimes.push(t)
  }
  // 确保最后一帧被截取
  if (keyframeTimes[keyframeTimes.length - 1] < durationSeconds) {
    keyframeTimes.push(durationSeconds)
  }

  console.log(`[render] 截取 ${keyframeTimes.length} 个关键帧 (${keyframeTimes.join(', ')}s)`)

  for (let i = 0; i < keyframeTimes.length; i++) {
    const t = keyframeTimes[i]
    const frameNum = Math.round(t * 30) // 30fps

    // 快进 CSS 动画到指定时间点
    await page.evaluate((time) => {
      // 设置所有动画的负延迟来快进
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

    // 等待渲染稳定
    await page.waitForTimeout(100)

    const framePath = join(outputDir, `frame_${String(frameNum).padStart(4, '0')}.png`)
    await page.screenshot({ path: framePath, type: 'png' })
    frames.push(framePath)

    if (i % 3 === 0 || i === keyframeTimes.length - 1) {
      console.log(`[render]  帧 ${frameNum} (${t}s) → ${framePath}`)
    }
  }

  await browser.close()
  console.log(`[render] ✅ 完成: ${frames.length} 帧 → ${outputDir}`)
  return frames
}

/**
 * 仅渲染单帧（用于封面图、预览等）
 */
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

  console.log(`[render] 单帧: ${outputPath}`)
  return outputPath
}

/**
 * 使用 Playwright 内置录屏功能生成视频（推荐模式）
 * 优势：CSS 动画完美捕获、音频支持、实时帧率
 * 输出：WebM 格式（可后续 FFmpeg 转 MP4）
 */
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

  console.log(`[render:video] 启动 Chromium (录屏模式)...`)

  // 清理旧 WebM 文件，避免重名冲突
  const { readdirSync: rd, unlinkSync, renameSync } = await import('node:fs')
  const oldFiles = rd(outputDir).filter(f => f.endsWith('.webm'))
  for (const f of oldFiles) {
    try { unlinkSync(join(outputDir, f)) } catch {}
  }

  const browser = await chromium.launch({ headless: true })

  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1, // 录屏模式用 1x 确保性能
    recordVideo: {
      dir: outputDir,
      size: { width, height },
    },
  })

  const page = await context.newPage()

  // 写入临时文件并加载（file:// 协议避免 CORS，可加载 localhost 图片）
  const htmlPath = writeTempHtml(html, outputDir)
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' })

  // 注入数据
  await page.evaluate((data) => {
    (window as any).typeData = data
  }, injectData)

  // 等待 CSS 动画播放
  console.log(`[render:video] 录制中... ${durationSeconds}s`)
  await page.waitForTimeout(durationSeconds * 1000)

  // 关闭页面以保存视频
  await page.close()
  await context.close()
  await browser.close()

  // Playwright 生成的视频文件名是随机的，找到并重命名它
  const files = rd(outputDir).filter(f => f.endsWith('.webm'))
  if (files.length === 0) {
    throw new Error('录屏失败：未生成 .webm 文件')
  }

  const sourcePath = join(outputDir, files[0])
  const targetPath = join(outputDir, `${typeCode}_raw.webm`)
  renameSync(sourcePath, targetPath)

  console.log(`[render:video] ✅ 录屏完成: ${targetPath}`)
  return targetPath
}
