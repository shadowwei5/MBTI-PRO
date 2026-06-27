// ============================================================
// MBTI-PRO Video Pipeline — FFmpeg 视频合成引擎
// PNG 帧序列 + 过渡效果 → MP4 视频
// ============================================================

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, writeFileSync, copyFileSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import type { ComposeConfig } from './types.js'

/** FFmpeg 二进制路径（由 @ffmpeg-installer/ffmpeg 提供） */
const FFMPEG_PATH = ffmpegInstaller.path

/**
 * 检测 FFmpeg 是否可用
 */
export async function checkFfmpeg(): Promise<boolean> {
  try {
    const { stdout } = await new Promise<{ stdout: string }>((resolve, reject) => {
      const proc = spawn(FFMPEG_PATH, ['-version'], { stdio: ['ignore', 'pipe', 'ignore'] })
      let output = ''
      proc.stdout?.on('data', (d: Buffer) => { output += d.toString() })
      proc.on('close', (code) => code === 0 ? resolve({ stdout: output }) : reject(new Error(`code=${code}`)))
      proc.on('error', reject)
    })
    console.log(`[compose] FFmpeg: ${stdout.split('\n')[0]}`)
    return true
  } catch {
    return false
  }
}

/**
 * 运行 FFmpeg 命令
 */
function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG_PATH, args, { stdio: 'inherit' })
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`FFmpeg 退出码: ${code}`))
    })
    proc.on('error', reject)
  })
}

/**
 * 将 PNG 帧序列合成为 MP4 视频
 *
 * 策略：
 * 1. 如果帧数 >= 目标帧数 → 直接 concat（每帧显示固定时长的1/N）
 * 2. 如果帧数少 → 使用 xfade 滤镜在帧之间创建平滑过渡
 * 3. 叠加 BGM（如果有）
 */
export async function composeVideo(config: ComposeConfig): Promise<string> {
  const {
    typeCode,
    framesDir,
    outputPath,
    width = 1080,
    height = 1920,
    fps = 30,
    bgmPath,
    transitionFrames = 15, // 过渡帧数 (0.5s @ 30fps)
    durationSeconds = 30,
  } = config

  // 检查 FFmpeg
  const ffmpegOk = await checkFfmpeg()
  if (!ffmpegOk) {
    throw new Error('FFmpeg 不可用。请安装 FFmpeg 或确保其在 PATH 中。')
  }

  if (!existsSync(framesDir)) {
    throw new Error(`帧目录不存在: ${framesDir}`)
  }

  // 确保输出目录存在
  const outDir = dirname(outputPath)
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true })
  }

  // 读取帧文件列表
  const frameFiles = readdirSync(framesDir)
    .filter(f => f.endsWith('.png'))
    .sort()

  if (frameFiles.length === 0) {
    throw new Error(`帧目录为空: ${framesDir}`)
  }

  console.log(`[compose] 输入: ${frameFiles.length} 帧, ${width}x${height}`)
  console.log(`[compose] 输出: ${outputPath}`)
  console.log(`[compose] 时长: ${durationSeconds}s @ ${fps}fps`)

  const totalTargetFrames = durationSeconds * fps

  if (frameFiles.length >= 10) {
    // 帧数足够：直接用 concat demuxer
    // 计算每帧显示时长
    const framesPerImage = Math.floor(totalTargetFrames / frameFiles.length)

    // 创建 concat 文件列表（每帧重复 framesPerImage 次）
    const concatLines: string[] = []
    for (const f of frameFiles) {
      const fullPath = join(framesDir, f).replace(/\\/g, '/')
      concatLines.push(`file '${fullPath}'`)
      concatLines.push(`duration ${(framesPerImage / fps).toFixed(3)}`)
    }
    // 最后一帧需要再添加一次以保证 concat 正确
    const lastFrame = join(framesDir, frameFiles[frameFiles.length - 1]).replace(/\\/g, '/')
    concatLines.push(`file '${lastFrame}'`)

    const concatFile = join(framesDir, 'concat_list.txt')
    writeFileSync(concatFile, concatLines.join('\n'), 'utf-8')

    const args = [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', concatFile,
    ]

    if (bgmPath && existsSync(bgmPath)) {
      console.log(`[compose] BGM: ${bgmPath}`)
      args.push('-i', bgmPath)
      args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '23')
      args.push('-pix_fmt', 'yuv420p')
      args.push('-c:a', 'aac', '-b:a', '128k')
      args.push('-shortest')
    } else {
      args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '23')
      args.push('-pix_fmt', 'yuv420p')
    }

    args.push(outputPath)

    console.log(`[compose] FFmpeg concat (${concatLines.length / 2} segments)...`)
    await runFfmpeg(args)

    // 清理 concat 文件
    try { require('fs').unlinkSync(concatFile) } catch {}
  } else {
    // 帧数较少：使用简单的帧序列合成
    const args = [
      '-y',
      '-framerate', String(fps / frameFiles.length), // 每帧的显示速率
      '-i', join(framesDir, 'frame_%04d.png').replace(/\\/g, '/'),
    ]

    if (bgmPath && existsSync(bgmPath)) {
      args.push('-i', bgmPath)
      args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '23')
      args.push('-pix_fmt', 'yuv420p')
      args.push('-c:a', 'aac', '-b:a', '128k')
      args.push('-shortest')
    } else {
      args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '23')
      args.push('-pix_fmt', 'yuv420p')
    }

    args.push('-t', String(durationSeconds))
    args.push(outputPath)

    console.log(`[compose] FFmpeg frames → video...`)
    await runFfmpeg(args)
  }

  console.log(`[compose] ✅ 完成: ${outputPath}`)
  return outputPath
}

/**
 * 合成口播视频 + 屏幕录屏
 */
export async function composeTalkingHead(
  talkingVideo: string,
  screencastVideo: string,
  outputPath: string,
  bgmPath?: string,
): Promise<string> {
  // 构建滤镜图：口播作为主画面，录屏作为画中画
  const filterComplex = [
    // 录屏缩放到 30% 并放在右下角
    `[1:v]scale=324:576[overlay]`,
    // 叠加
    `[0:v][overlay]overlay=W-w-30:H-h-30:enable='between(t,0,999)'[vout]`,
  ].join(';')

  const args = [
    '-y',
    '-i', talkingVideo,
    '-i', screencastVideo,
    '-filter_complex', filterComplex,
    '-map', '[vout]',
    '-map', '0:a', // 使用口播的音频
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '128k',
  ]

  if (bgmPath && existsSync(bgmPath)) {
    args.push('-i', bgmPath)
    // 混合 BGM（音量降低 60%）
    args.push('-filter_complex',
      filterComplex + `;[2:a]volume=0.4[bgm];[0:a][bgm]amix=inputs=2:duration=first[aout]`)
    args.push('-map', '[aout]')
  }

  args.push(outputPath)

  console.log(`[compose] 口播+录屏拼接 → ${outputPath}`)
  await runFfmpeg(args)
  console.log(`[compose] ✅ 完成`)
  return outputPath
}

/**
 * 将 Playwright 录制的 WebM 转换为 MP4 (H.264 + AAC)
 * 同时缩放到目标分辨率
 */
export async function convertWebmToMp4(
  webmPath: string,
  outputPath: string,
  width: number = 1080,
  height: number = 1920,
): Promise<string> {
  if (!existsSync(webmPath)) {
    throw new Error(`WebM 文件不存在: ${webmPath}`)
  }

  const outDir = dirname(outputPath)
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

  console.log(`[compose:convert] WebM → MP4`)
  console.log(`  输入: ${webmPath}`)
  console.log(`  输出: ${outputPath} (${width}x${height})`)

  const args = [
    '-y',
    '-i', webmPath,
    '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`,
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
    '-r', '30',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-movflags', '+faststart',
    outputPath,
  ]

  await runFfmpeg(args)
  console.log(`[compose:convert] ✅ 完成: ${outputPath}`)
  return outputPath
}

/**
 * 将视频 + 音频 + 字幕合成为最终成品
 */
export async function muxAudioAndSubtitles(
  videoPath: string,
  audioPath: string,
  subtitlePath: string,
  outputPath: string,
): Promise<string> {
  if (!existsSync(videoPath)) throw new Error(`视频不存在: ${videoPath}`)
  if (!existsSync(audioPath)) throw new Error(`音频不存在: ${audioPath}`)

  const hasSubtitles = subtitlePath && existsSync(subtitlePath)

  const outDir = dirname(outputPath)
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

  if (hasSubtitles) {
    console.log(`[compose:mux] 合成音视频+字幕`)
    console.log(`  字幕: ${subtitlePath}`)
  } else {
    console.log(`[compose:mux] 合成音视频 (无字幕)`)
  }
  console.log(`  视频: ${videoPath}`)
  console.log(`  音频: ${audioPath}`)

  const args = [
    '-y',
    '-i', videoPath,
    '-i', audioPath,
  ]

  if (hasSubtitles) {
    const srtCopy = join(dirname(outputPath), '_temp_sub.srt')
    copyFileSync(subtitlePath, srtCopy)
    const safeSubPath = srtCopy.replace(/\\/g, '/').replace(/^([A-Za-z]):/, '$1\\:')
    args.push('-vf', `subtitles='${safeSubPath}':force_style='FontName=Noto Sans SC,FontSize=18,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,Outline=2,Alignment=2,MarginV=40'`)
  }

  args.push(
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '23',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k',
    '-map', '0:v:0', '-map', '1:a:0',
    '-shortest', '-movflags', '+faststart',
    outputPath,
  )

  await runFfmpeg(args)
  // 清理临时字幕副本
  if (hasSubtitles) {
    const srtCopy = join(dirname(outputPath), '_temp_sub.srt')
    try { unlinkSync(srtCopy) } catch {}
  }
  console.log(`[compose:mux] ✅ 完成: ${outputPath}`)
  return outputPath
}
