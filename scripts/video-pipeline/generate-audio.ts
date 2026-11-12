// ============================================================
// MBTI-PRO Video Pipeline — TTS 配音 + SRT 字幕生成
// 使用微软 Edge TTS（免费、中文语音质量优秀）
// ============================================================

import { existsSync, mkdirSync, writeFileSync, unlinkSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'

const FFMPEG_PATH = ffmpegInstaller.path

/** 中文女声 — 微软云希 (xiaoxiao) ，自然亲切适合视频配音 */
const VOICE = 'zh-CN-XiaoxiaoNeural'
/** 语速：用户反馈略慢，提升到更接近抖音口播节奏 */
const RATE = '+30%'

/**
 * 用 edge-tts 将文本数组转为单个 MP3 音频文件
 * 自动计算每段时间戳，同时生成 SRT 字幕
 */
export async function generateVoiceover(
  segments: VoiceSegment[],
  outputDir: string,
  prefix: string = 'voice',
): Promise<{ audioPath: string; subtitlePath: string }> {
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true })

  const audioPath = join(outputDir, `${prefix}.mp3`)
  const subtitlePath = join(outputDir, `${prefix}.srt`)

  // 方案：逐段生成语音，合并为一个 MP3
  // edge-tts 只支持单次请求，所以逐段调用然后 FFmpeg 合并

  const tempFiles: string[] = []
  const subtitleEntries: { index: number; start: string; end: string; text: string }[] = []
  let subtitleIndex = 1

  let currentTimeMs = 0

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    const tempFile = join(outputDir, `_temp_${String(i).padStart(3, '0')}.mp3`)

    const speechText = seg.speechText || optimizeSpeechText(seg.text)
    const subtitleText = seg.subtitleText || seg.text

    console.log(`[tts] ${i + 1}/${segments.length}: "${subtitleText.substring(0, 40)}..."`)
    try {
      await ttsSingle(speechText, tempFile)
    } catch (error) {
      if (existsSync(audioPath) && existsSync(subtitlePath)) {
        console.warn(`[tts] ⚠️ TTS 临时不可用，复用缓存音频和字幕: ${audioPath}`)
        for (const tf of tempFiles) {
          try { unlinkSync(tf) } catch {}
        }
        return { audioPath, subtitlePath }
      }
      throw error
    }

    // 获取音频时长
    const durationMs = await getAudioDuration(tempFile)
    const startTime = currentTimeMs
    const endTime = startTime + durationMs

    const chunks = splitSubtitleChunks(subtitleText)
    const totalWeight = chunks.reduce((sum, chunk) => sum + Math.max(1, chunk.replace(/\s+/g, '').length), 0)
    let chunkStartMs = startTime
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex]
      const isLastChunk = chunkIndex === chunks.length - 1
      const weight = Math.max(1, chunk.replace(/\s+/g, '').length)
      const chunkDuration = isLastChunk
        ? endTime - chunkStartMs
        : Math.max(900, Math.round(durationMs * (weight / totalWeight)))
      const chunkEndMs = isLastChunk ? endTime : Math.min(endTime, chunkStartMs + chunkDuration)
      subtitleEntries.push({
        index: subtitleIndex++,
        start: msToSrtTime(chunkStartMs),
        end: msToSrtTime(chunkEndMs),
        text: wrapSubtitleText(chunk),
      })
      chunkStartMs = chunkEndMs
      if (chunkStartMs >= endTime) break
    }

    currentTimeMs = endTime
    tempFiles.push(tempFile)

    const pauseMs = Math.max(0, seg.pauseMs ?? defaultPauseMs(subtitleText, i, segments.length))
    if (pauseMs > 0 && i < segments.length - 1) {
      const silenceFile = join(outputDir, `_temp_${String(i).padStart(3, '0')}_pause.mp3`)
      await createSilenceAudio(silenceFile, pauseMs)
      tempFiles.push(silenceFile)
      currentTimeMs += pauseMs
    }
  }

  // 合并所有临时音频文件
  console.log(`[tts] 合并 ${tempFiles.length} 段音频...`)
  await concatAudioFiles(tempFiles, audioPath)

  // 生成 SRT 字幕
  const srtContent = subtitleEntries
    .map(e => `${e.index}\n${e.start} --> ${e.end}\n${e.text}\n`)
    .join('\n')
  writeFileSync(subtitlePath, srtContent, 'utf-8')

  // 清理临时文件
  for (const tf of tempFiles) {
    try { unlinkSync(tf) } catch {}
  }

  console.log(`[tts] ✅ 配音: ${audioPath}`)
  console.log(`[tts] ✅ 字幕: ${subtitlePath} (${subtitleEntries.length} 条)`)
  return { audioPath, subtitlePath }
}

function splitSubtitleChunks(text: string): string[] {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim()
  if (!normalized) return []

  const chunks: string[] = []
  let buffer = ''
  const chars = [...normalized]
  for (const char of chars) {
    buffer += char
    const shouldBreak = /[。！？!?；;]/.test(char) || (/[，,、：:]/.test(char) && buffer.length >= 12) || buffer.length >= 24
    if (shouldBreak) {
      pushSubtitleChunk(chunks, buffer)
      buffer = ''
    }
  }
  pushSubtitleChunk(chunks, buffer)

  return chunks
}

function pushSubtitleChunk(chunks: string[], value: string): void {
  const chunk = value.trim()
  if (!chunk || /^[。！？!?；;，,、：:]$/.test(chunk)) return
  chunks.push(chunk)
}

function defaultPauseMs(text: string, index: number, total: number): number {
  if (index >= total - 1) return 0
  const normalized = String(text || '').trim()
  if (!normalized) return 0
  if (/[？?！!]$/.test(normalized)) return 360
  if (/[。.]$/.test(normalized)) return 280
  return 180
}

async function createSilenceAudio(outputPath: string, durationMs: number): Promise<void> {
  const durationSeconds = Math.max(0.05, durationMs / 1000)
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG_PATH, [
      '-y',
      '-f', 'lavfi',
      '-i', 'anullsrc=r=24000:cl=mono',
      '-t', durationSeconds.toFixed(3),
      '-c:a', 'libmp3lame',
      '-b:a', '96k',
      outputPath,
    ], { stdio: 'pipe' })
    let stderr = ''
    proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString() })
    proc.on('close', code => {
      code === 0 && existsSync(outputPath) ? resolve() : reject(new Error(`????????: code=${code}; ${stderr.slice(-200)}`))
    })
    proc.on('error', reject)
  })
}

function wrapSubtitleText(text: string): string {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim()
  if (normalized.length <= 22) return normalized

  const punctuationBreak = findLineBreak(normalized, /[，,、：:]/g)
  if (punctuationBreak > 0) {
    return `${normalized.slice(0, punctuationBreak)}\n${normalized.slice(punctuationBreak)}`
  }

  const middle = Math.ceil(normalized.length / 2)
  const breakAt = Math.min(normalized.length - 1, Math.max(12, middle))
  return `${normalized.slice(0, breakAt)}\n${normalized.slice(breakAt)}`
}

function findLineBreak(text: string, pattern: RegExp): number {
  const middle = text.length / 2
  let best = -1
  let bestDistance = Number.POSITIVE_INFINITY
  for (const match of text.matchAll(pattern)) {
    const index = (match.index ?? 0) + match[0].length
    if (index < 8 || index > text.length - 6) continue
    const distance = Math.abs(index - middle)
    if (distance < bestDistance) {
      best = index
      bestDistance = distance
    }
  }
  return best
}

/** 单段 TTS — 优先使用 Python edge-tts，兼容 Windows py 启动器 */
async function ttsSingle(text: string, outputPath: string): Promise<void> {
  const candidates: { command: string; prefix: string[] }[] = process.platform === 'win32'
    ? [
        { command: 'py', prefix: ['-m', 'edge_tts'] },
        { command: 'python', prefix: ['-m', 'edge_tts'] },
        { command: 'python3', prefix: ['-m', 'edge_tts'] },
      ]
    : [
        { command: 'python3', prefix: ['-m', 'edge_tts'] },
        { command: 'python', prefix: ['-m', 'edge_tts'] },
      ]

  const args = [
    '--voice', VOICE,
    '--rate', RATE,
    '--text', text,
    '--write-media', outputPath,
  ]

  const errors: string[] = []
  for (const candidate of candidates) {
    try {
      await runTtsCandidate(candidate.command, [...candidate.prefix, ...args], outputPath)
      return
    } catch (error) {
      errors.push(`${candidate.command}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  throw new Error(`TTS 失败，未找到可用 edge-tts 后端：${errors.join(' | ')}`)
}

function runTtsCandidate(command: string, args: string[], outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { stdio: 'pipe' })
    let stderr = ''
    proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString() })
    proc.on('close', (code) => {
      if (code === 0 && existsSync(outputPath)) resolve()
      else reject(new Error(`code=${code}; ${stderr.slice(-240)}`))
    })
    proc.on('error', reject)
  })
}

/** 获取 MP3 音频时长（毫秒）— 用 FFmpeg 读取 */
async function getAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve) => {
    const proc = spawn(FFMPEG_PATH, ['-i', filePath], { stdio: 'pipe' })
    let stderr = ''
    proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString() })
    proc.on('close', () => {
      // FFmpeg 将时长信息输出到 stderr: Duration: 00:00:03.50
      const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+)\.(\d+)/)
      if (match) {
        const ms = (+match[1] * 3600 + +match[2] * 60 + +match[3]) * 1000 + +match[4] * 10
        resolve(ms)
      } else {
        // 降级估算：中文 ~3.5 字/秒
        const stat = statSync(filePath)
        resolve(Math.max(2000, Math.round(stat.size / 2000) * 1000))
      }
    })
    proc.on('error', () => resolve(3000))
  })
}

/** 用 FFmpeg 合并多个 MP3 文件 */
async function concatAudioFiles(inputPaths: string[], outputPath: string): Promise<void> {
  // 写入 concat 列表
  const listPath = outputPath.replace('.mp3', '_list.txt')
  const listContent = inputPaths.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n')
  writeFileSync(listPath, listContent, 'utf-8')

  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG_PATH, [
      '-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c:a', 'libmp3lame', '-b:a', '128k', outputPath,
    ], { stdio: 'inherit' })
    proc.on('close', (code) => {
      try { unlinkSync(listPath) } catch {}
      code === 0 ? resolve() : reject(new Error(`音频合并失败`))
    })
    proc.on('error', reject)
  })
}

/** 毫秒 → SRT 时间格式 */
function msToSrtTime(ms: number): string {
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  const ms2 = ms % 1000
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms2).padStart(3, '0')}`
}

export interface VoiceSegment {
  text: string
  speechText?: string
  subtitleText?: string
  pauseMs?: number
}

function fixPronunciation(text: string): string {
  return String(text || '')
    .replace(/(\d+)型/g, '$1形')
    .replace(/十六型/g, '十六形')
    .replace(/八十一型/g, '八十一形')
    .replace(/中间型/g, '中间形')
    .replace(/型人格/g, '形人格')
}

function optimizeSpeechText(text: string): string {
  const step1 = String(text || '')
    .replace(/\bENTP\b/g, 'E N T P')
    .replace(/\bINTP\b/g, 'I N T P')
    .replace(/\bINTJ\b/g, 'I N T J')
    .replace(/\bENFP\b/g, 'E N F P')
    .replace(/\bENFJ\b/g, 'E N F J')
  return fixPronunciation(step1)
}

/**
 * 生成介绍视频的配音脚本
 */
export function getIntroVideoScript(): VoiceSegment[] {
  return [
    { text: '你测的MBTI，可能根本不准。' },
    { text: '传统测试让你非此即彼。二的四次方，只有十六种。但大部分人，其实卡在中间。' },
    { text: 'MBTI-PRO给每个维度增加了一个中间值。三的四次方，八十一种人格，精准五倍。' },
    { text: '能量：外向E、平衡A、内向I。认知：直觉N、均衡B、实感S。决策：思考T、复合C、情感F。态度：判断J、动态D、感知P。' },
    { text: '九组颜色分类，八十一张AI专属插画。七百字深度人格画像，一百题科学测评。' },
    { text: '完全免费，无需注册，隐私保护。' },
    { text: '不再被简单的四个字母定义。来MBTI-PRO，发现真实的自己。' },
    { text: '点击我的主页查看免费测试网址，测试完成后来评论区分享你的全新人格类型吧！' },
  ]
}

/**
 * 根据人格类型数据生成日常视频配音脚本
 */
export function getDailyTypeScript(typeData: any): VoiceSegment[] {
  const name = typeData.name || ''
  const overview = (typeData.overview || '').substring(0, 100)
  const strength1 = typeData.strengths?.[0] || ''
  const strength2 = typeData.strengths?.[1] || ''
  const celeb = typeData.celebrities?.[0] || ''
  const groupName = typeData._groupName || ''

  return [
    { text: `${name}型人格，属于${groupName}。` },
    { text: `${strength1}是你的核心优势之一，同时你也擅长${strength2}。` },
    { text: overview },
    { text: `代表人物包括${celeb}。你的性格类型独特而珍贵。` },
    { text: '想了解自己的真实人格吗？来MBTI-PRO，测测你的81型人格。' },
  ]
}

/**
 * 根据人格类型数据生成故事型日常视频配音脚本
 * 目标：短视频前 3 秒强共鸣，中段讲一个人格场景，末尾给成长提醒和测试 CTA。
 */
export function getStoryTypeScript(typeData: any): VoiceSegment[] {
  const code = typeData.code || 'ENFJ'
  const marketing = typeData.marketing || {}
  if (Array.isArray(marketing.voiceSegments) && marketing.voiceSegments.length > 0) {
    return marketing.voiceSegments.map((text: string, index: number) => ({
      text,
      speechText: optimizeSpeechText(text),
      pauseMs: index === marketing.voiceSegments.length - 1 ? 0 : undefined,
    }))
  }

  const name = typeData.name || code + '\u578B'
  const overview = cleanText(typeData.overview || '')
  const strengths = typeData.strengths || []
  const growthAreas = typeData.growthAreas || []
  const groupName = typeData._groupName || getGroupName(typeData._groupCode) || typeData._groupCode || '81\u578B\u4EBA\u683C'

  const strength1 = shortenTrait(strengths[0] || '\u770B\u89C1\u4ED6\u4EBA\u7684\u6F5C\u529B', 18)
  const strength2 = shortenTrait(strengths[1] || '\u628A\u6DF7\u4E71\u91CD\u65B0\u7EC4\u7EC7\u8D77\u6765', 18)
  const growth = shortenTrait(growthAreas[0] || '\u4E5F\u8981\u628A\u81EA\u5DF1\u7684\u9700\u6C42\u653E\u5728\u91CD\u8981\u4F4D\u7F6E', 22)
  const personaLine = extractPersonaLine(overview, name)
  const scene = buildStoryScene(code)

  return [
    { text: '\u4F60\u8EAB\u8FB9\u6709\u6CA1\u6709\u8FD9\u6837\u4E00\u4E2A\u4EBA\uFF1A' + scene.hook + '\u3002' },
    { text: scene.story },
    { text: '\u8FD9\u5C31\u662F' + code + '\uFF0C' + name + '\uFF0C\u5C5E\u4E8E' + groupName + '\u3002' },
    { text: '\u4ED6\u4EEC\u64C5\u957F' + strength1 + '\uFF0C\u540C\u65F6\u5177\u5907' + strength2 + '\u3002' + personaLine },
    { text: '\u4F46\u4E5F\u8981\u8BB0\u4F4F\uFF1A' + growth + '\u3002\u60F3\u77E5\u9053\u4F60\u662F\u54EA\u4E00\u79CD\uFF1F\u6765MBTI-PRO\uFF0C\u6D4B\u6D4B\u4F60\u768481\u578B\u4EBA\u683C\u3002' },
  ]
}

function getGroupName(groupCode: string): string {
  const names: Record<string, string> = {
    SP: 'SP 暖金组', SD: 'SD 琥珀组', SJ: 'SJ 藏蓝组',
    BT: 'BT 深炭灰组', BC: 'BC 月光银灰组', BF: 'BF 暖燕麦组',
    NT: 'NT 深紫组', NC: 'NC 靛青组', NF: 'NF 翠绿组',
  }
  return names[groupCode] || ''
}

function cleanText(text: string): string {
  return String(text).replace(/\s+/g, ' ').trim()
}

function shortenTrait(text: string, maxLength = 28): string {
  const normalized = cleanText(text).replace(/[。；;，,]$/g, '')
  return normalized.length > maxLength ? `${normalized.substring(0, maxLength)}…` : normalized
}

function extractPersonaLine(overview: string, name: string): string {
  const fallback = `${name}的珍贵之处，是能在复杂关系里看见人的真实需求。`
  if (!overview) return fallback

  const sentences = overview
    .split(/[。！？!?]/)
    .map(s => s.trim())
    .filter(s => s.length >= 14 && s.length <= 34)

  const keywords = ['你有', '你是', '你擅长', '你天然', '你内心', '你的存在']
  const matched = sentences.find(sentence => keywords.some(keyword => sentence.includes(keyword)))
  return matched ? `${matched}。` : `${sentences[0] || fallback}。`
}

function buildStoryScene(code: string) {
  const first = code[0]
  const second = code[1]
  const third = code[2]
  const fourth = code[3]

  const energy = first === 'E'
    ? '明明自己也很累，却总能第一时间发现别人快撑不住了'
    : first === 'I'
      ? '话不多，却总在关键时刻给出最清醒的判断'
      : '既能安静观察，也能在需要时站出来稳定全场'

  const perception = second === 'N'
    ? '他看到的不是眼前的小问题，而是每个人未来可能成为的样子'
    : second === 'S'
      ? '他不说空话，总能把混乱的现场拆成一步一步能做的事'
      : '他既能看见现实细节，也能抓住背后真正重要的趋势'

  const decision = third === 'T'
    ? '别人还在情绪里打转时，他已经开始搭建解决问题的框架'
    : third === 'F'
      ? '别人只看到任务时，他先看见每个人心里没有说出口的压力'
      : '他能同时照顾逻辑和感受，让决定既有效率也有人情味'

  const lifestyle = fourth === 'J'
    ? '最后，他会把所有人重新排好节奏，像一位温暖而坚定的总指挥'
    : fourth === 'P'
      ? '最后，他不会急着定死答案，而是带大家找到更自由的可能性'
      : '最后，他会在计划和变化之间来回校准，找到刚刚好的平衡点'

  return {
    hook: energy,
    story: `${perception}。${decision}。`,
  }
}

