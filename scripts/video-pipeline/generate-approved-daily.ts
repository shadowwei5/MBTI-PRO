import { existsSync, mkdirSync, copyFileSync, writeFileSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import { renderFullFrameSequence } from './render-frames.js'
import { composeFrameSequenceToMp4, muxAudioAndSubtitles } from './compose-video.js'
import { generateVoiceover, getStoryTypeScript } from './generate-audio.js'
import type { PersonalityTypeData } from './types.js'

const ROOT = resolve(import.meta.dirname, '..', '..')
const OUTPUT_DIR = join(ROOT, 'video', 'output')
const WORK_DIR = join(ROOT, 'video', 'work')
const QA_DIR = join(OUTPUT_DIR, 'daily_qa')
const FFMPEG = ffmpegInstaller.path

interface Options {
  code: string
  duration: number
  suffix: string
  tailSeconds: number
  skipCover: boolean
  skipRender: boolean
  skipVoice: boolean
  renderOnly: boolean
  voicePrefix: string
  quality: '1080p' | '2k'
  fps: number
}

function parseArgs(): Options {
  const args = process.argv.slice(2)
  const opts: Options = {
    code: '',
    duration: 50,
    suffix: 'daily_approved',
    tailSeconds: 0.55,
    skipCover: false,
    skipRender: false,
    skipVoice: false,
    renderOnly: false,
    voicePrefix: '',
    quality: '2k',
    fps: 30,
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--type' || arg === '--code') opts.code = (args[++i] || '').toUpperCase()
    else if (arg === '--duration') opts.duration = Number(args[++i] || 50)
    else if (arg === '--suffix') opts.suffix = args[++i] || opts.suffix
    else if (arg === '--tail-seconds') opts.tailSeconds = Number(args[++i] || opts.tailSeconds)
    else if (arg === '--quality') opts.quality = (args[++i] || opts.quality) as Options['quality']
    else if (arg === '--fps') opts.fps = Number(args[++i] || opts.fps)
    else if (arg === '--voice-prefix') opts.voicePrefix = args[++i] || opts.voicePrefix
    else if (arg === '--skip-cover') opts.skipCover = true
    else if (arg === '--skip-render') opts.skipRender = true
    else if (arg === '--skip-voice') opts.skipVoice = true
    else if (arg === '--render-only' || arg === '--no-mux') opts.renderOnly = true
  }

  if (!/^[EAI][NBS][TCF][JDP]$/.test(opts.code)) {
    throw new Error('请使用 --type CODE，例如：--type ENFJ')
  }
  if (!['1080p', '2k'].includes(opts.quality)) {
    throw new Error('请使用 --quality 2k 或 --quality 1080p')
  }
  return opts
}

function run(command: string, args: string[], cwd = import.meta.dirname): Promise<void> {
  return new Promise((resolveRun, reject) => {
    console.log(`\n$ ${command} ${args.join(' ')}`)
    const child = spawn(command, args, { cwd, shell: process.platform === 'win32', stdio: 'inherit' })
    child.on('close', code => code === 0 ? resolveRun() : reject(new Error(`${command} exited with ${code}`)))
    child.on('error', reject)
  })
}

function ffmpegText(args: string[]): Promise<string> {
  return new Promise((resolveRun) => {
    const child = spawn(FFMPEG, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let text = ''
    child.stdout?.on('data', chunk => { text += chunk.toString() })
    child.stderr?.on('data', chunk => { text += chunk.toString() })
    child.on('close', () => resolveRun(text))
    child.on('error', error => resolveRun(String(error)))
  })
}

async function getDurationSeconds(filePath: string): Promise<number> {
  const text = await ffmpegText(['-i', filePath])
  const match = text.match(/Duration:\s*(\d+):(\d+):(\d+)\.(\d+)/)
  if (!match) return 0
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(`0.${match[4]}`)
}

async function trimVideo(input: string, output: string, seconds: number): Promise<void> {
  await run(FFMPEG, ['-y', '-i', input, '-t', seconds.toFixed(2), '-c', 'copy', output], ROOT)
}

async function extractFrame(video: string, atSeconds: number, output: string): Promise<void> {
  await run(FFMPEG, ['-y', '-ss', atSeconds.toFixed(2), '-i', video, '-vframes', '1', output], ROOT)
}

async function ensureTypeData(code: string): Promise<PersonalityTypeData> {
  const workDir = join(WORK_DIR, code)
  const dataPath = join(workDir, `${code}.json`)
  if (!existsSync(dataPath)) {
    const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
    const relativeOutputDir = `../../video/work/${code}`
    await run(npx, ['tsx', 'fetch-type-data.ts', code, relativeOutputDir], import.meta.dirname)
  }
  if (!existsSync(dataPath)) throw new Error(`缺少人格数据缓存：${dataPath}`)
  return JSON.parse(readFileSync(dataPath, 'utf8')) as PersonalityTypeData
}

function copyApprovedCover(code: string, suffix: string) {
  const sourceCoverPath = join(OUTPUT_DIR, `cover_${code}_v4.png`)
  const reviewCoverPath = join(OUTPUT_DIR, `cover_${code}_${suffix}.png`)
  if (existsSync(sourceCoverPath)) copyFileSync(sourceCoverPath, reviewCoverPath)
  return existsSync(reviewCoverPath) ? reviewCoverPath : sourceCoverPath
}

function resolutionFor(quality: Options['quality']) {
  return quality === '2k'
    ? { width: 1440, height: 2560, crf: 16, frameDirName: 'frames_2k' }
    : { width: 1080, height: 1920, crf: 17, frameDirName: 'frames_1080p' }
}

async function main() {
  const opts = parseArgs()
  const code = opts.code
  const quality = resolutionFor(opts.quality)
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true })

  const data = await ensureTypeData(code)
  const audioDir = join(WORK_DIR, code, 'audio')
  mkdirSync(audioDir, { recursive: true })

  if (!opts.skipCover) {
    await run('npx', ['tsx', 'generate-v3-cover.ts', code])
  }

  const coverPath = copyApprovedCover(code, opts.suffix)
  const audioPrefix = opts.voicePrefix || code
  const audioPath = join(audioDir, `${audioPrefix}.mp3`)
  const subtitlePath = join(audioDir, `${audioPrefix}.srt`)

  if (opts.renderOnly) {
    console.log('\n[voice] 仅渲染无配音视频，跳过配音/字幕合成')
  } else if (opts.skipVoice || opts.voicePrefix) {
    console.log(`\n[voice] 复用配音与字幕: ${audioPrefix}`)
  } else {
    console.log('\n[voice] 生成/刷新故事配音与字幕')
    await generateVoiceover(getStoryTypeScript(data), audioDir, code)
  }

  if (!opts.renderOnly && !existsSync(audioPath)) throw new Error(`音频不存在: ${audioPath}`)
  if (!opts.renderOnly && !existsSync(subtitlePath)) throw new Error(`字幕不存在: ${subtitlePath}`)

  const audioDuration = opts.renderOnly ? 0 : await getDurationSeconds(audioPath)
  const renderDuration = Math.max(opts.duration, Math.ceil(audioDuration + opts.tailSeconds + 0.25))
  const framesDir = join(WORK_DIR, code, quality.frameDirName)
  const noVoiceVideo = join(OUTPUT_DIR, `${code}_${opts.suffix}_${opts.quality}_novoice.mp4`)
  const muxedVideo = join(OUTPUT_DIR, `${code}_${opts.suffix}_${opts.quality}_muxed.mp4`)
  const finalVideo = join(OUTPUT_DIR, `${code}_${opts.suffix}.mp4`)

  if (!opts.skipRender) {
    await renderFullFrameSequence({
      typeCode: code,
      outputDir: framesDir,
      width: quality.width,
      height: quality.height,
      fps: opts.fps,
      durationSeconds: renderDuration,
      keyframeInterval: 1 / opts.fps,
      template: 'story-video',
    }, data)
    await composeFrameSequenceToMp4(framesDir, noVoiceVideo, opts.fps, { crf: quality.crf })
  }

  if (!existsSync(noVoiceVideo)) throw new Error(`无配音视频不存在: ${noVoiceVideo}`)

  if (opts.renderOnly) {
    const frameDir = join(QA_DIR, code)
    mkdirSync(frameDir, { recursive: true })
    const frameTimes = [2, 8, 12, 25, 36, 42, Math.max(1, renderDuration - 1.5)]
    const framePaths: string[] = []
    for (const time of frameTimes) {
      const framePath = join(frameDir, `${code}_${opts.suffix}_${opts.quality}_${String(Math.round(time * 10)).padStart(4, '0')}_novoice.png`)
      await extractFrame(noVoiceVideo, Math.min(time, Math.max(0, renderDuration - 0.2)), framePath)
      framePaths.push(framePath)
    }
    const report = {
      code,
      generatedAt: new Date().toISOString(),
      quality: opts.quality,
      width: quality.width,
      height: quality.height,
      fps: opts.fps,
      noVoiceVideo,
      coverPath,
      renderDuration,
      framePaths,
      nextStep: `在剪映使用刘语熙音色生成配音后，导出到 video/work/${code}/audio/${code}_jianying_liuyuxi.mp3，再用 remix-daily-audio.ts 合成。`,
    }
    const reportPath = join(frameDir, `${code}_${opts.suffix}_${opts.quality}_novoice_qa.json`)
    writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8')
    console.log('\n✅ 无配音高清视频已生成')
    console.log(`无配音视频: ${noVoiceVideo}`)
    console.log(`封面: ${coverPath}`)
    console.log(`QA: ${reportPath}`)
    return
  }

  await muxAudioAndSubtitles(noVoiceVideo, audioPath, subtitlePath, muxedVideo, {
    width: quality.width,
    height: quality.height,
    ...(opts.quality === '2k'
      ? { videoBitrate: '35M', minrate: '30M', maxrate: '45M', bufsize: '90M' }
      : { videoCrf: quality.crf }),
  })

  const muxedDuration = await getDurationSeconds(muxedVideo)
  const targetDuration = Math.min(muxedDuration || renderDuration, (audioDuration || renderDuration) + opts.tailSeconds)
  await trimVideo(muxedVideo, finalVideo, targetDuration)

  const frameDir = join(QA_DIR, code)
  mkdirSync(frameDir, { recursive: true })
  const frameTimes = [2, 8, 12, 25, 36, 42, Math.max(1, targetDuration - 1.5)]
  const framePaths: string[] = []
  for (const time of frameTimes) {
    const framePath = join(frameDir, `${code}_${opts.suffix}_${opts.quality}_${String(Math.round(time * 10)).padStart(4, '0')}.png`)
    await extractFrame(finalVideo, Math.min(time, Math.max(0, targetDuration - 0.2)), framePath)
    framePaths.push(framePath)
  }

  const report = {
    code,
    generatedAt: new Date().toISOString(),
    quality: opts.quality,
    width: quality.width,
    height: quality.height,
    fps: opts.fps,
    finalVideo,
    noVoiceVideo,
    muxedVideo,
    coverPath,
    audioPath,
    subtitlePath,
    audioDuration,
    renderDuration,
    finalDuration: await getDurationSeconds(finalVideo),
    framePaths,
    qaChecklist: [
      '封面人格图必须加载，不得白框',
      '视频前 2 秒人格图必须完整显示',
      '人物图使用 contain，不得裁切主体',
      '文字模块不得与其他文字模块重叠',
      '底部字幕不得被卡片、维度条、CTA 或平台控件遮挡',
      '右上角和结尾二维码必须是真实可扫码二维码，不得是文字占位白框',
      '最后一句口播结束后不得留下 2 秒以上静止尾帧',
    ],
  }
  const reportPath = join(frameDir, `${code}_${opts.suffix}_${opts.quality}_qa.json`)
  writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8')

  console.log('\n✅ 每日视频高清最终版已生成')
  console.log(`视频: ${finalVideo}`)
  console.log(`封面: ${coverPath}`)
  console.log(`QA: ${reportPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

