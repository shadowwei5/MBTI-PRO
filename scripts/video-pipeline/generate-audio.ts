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
/** 语速：-10% ~ +10%，这里用 +5% 让视频更有节奏感 */
const RATE = '+15%'

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

  let currentTimeMs = 0

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    const tempFile = join(outputDir, `_temp_${String(i).padStart(3, '0')}.mp3`)

    console.log(`[tts] ${i + 1}/${segments.length}: "${seg.text.substring(0, 40)}..."`)
    await ttsSingle(seg.text, tempFile)

    // 获取音频时长
    const durationMs = await getAudioDuration(tempFile)
    const startTime = currentTimeMs
    const endTime = startTime + durationMs

    subtitleEntries.push({
      index: i + 1,
      start: msToSrtTime(startTime),
      end: msToSrtTime(endTime),
      text: seg.text,
    })

    currentTimeMs = endTime
    tempFiles.push(tempFile)
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

/** 单段 TTS — 使用 Python edge-tts（Windows 稳定） */
async function ttsSingle(text: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('python', [
      '-m', 'edge_tts',
      '--voice', VOICE,
      '--rate', RATE,
      '--text', text,
      '--write-media', outputPath,
    ], { stdio: 'pipe' })

    let stderr = ''
    proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString() })
    proc.on('close', (code) => {
      if (code === 0 && existsSync(outputPath)) resolve()
      else reject(new Error(`TTS 失败 (code=${code}): ${stderr.slice(-200)}`))
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
      '-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', outputPath,
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
