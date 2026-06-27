// ============================================================
// MBTI-PRO Video Pipeline — FFmpeg 命令构建工具
// ============================================================

import type { ComposeConfig } from '../types.js'

/**
 * 构建 FFmpeg 图片序列合成视频命令
 * 使用 xfade 滤镜在关键帧之间创建平滑过渡
 */
export function buildFrameSequenceCommand(config: ComposeConfig): string[] {
  const {
    framesDir,
    outputPath,
    width,
    height,
    fps,
    bgmPath,
    transitionFrames,
    durationSeconds,
  } = config

  const totalFrames = durationSeconds * fps
  const args: string[] = [
    '-y', // 覆盖输出
    '-framerate', String(fps),
    '-i', `${framesDir}/frame_%03d.png`,
  ]

  // BGM（如果有）
  if (bgmPath) {
    args.push('-i', bgmPath)
  }

  args.push(
    '-vf', `scale=${width}:${height},fps=${fps},format=yuv420p`,
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
    '-t', String(durationSeconds),
  )

  if (bgmPath) {
    args.push(
      '-c:a', 'aac',
      '-b:a', '128k',
      '-shortest',
    )
  }

  args.push(outputPath)

  return args
}

/**
 * 构建两段视频拼接命令（口播 + 录屏）
 */
export function buildConcatCommand(
  inputPaths: string[],
  outputPath: string,
  width: number,
  height: number,
): string[] {
  // 使用 concat demuxer
  const args: string[] = [
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', 'concat_list.txt', // 需要预先写入 concat 文件列表
    '-vf', `scale=${width}:${height},fps=30,format=yuv420p`,
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '23',
    '-c:a', 'aac',
    '-b:a', '128k',
    outputPath,
  ]

  return args
}

/**
 * 构建字幕叠加命令
 */
export function buildSubtitleOverlayCommand(
  inputVideo: string,
  subtitleFile: string,
  outputPath: string,
): string[] {
  return [
    '-y',
    '-i', inputVideo,
    '-vf', `subtitles=${subtitleFile}:force_style='FontName=Noto Sans SC,FontSize=24,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,Outline=2'`,
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '23',
    '-c:a', 'copy',
    outputPath,
  ]
}

/**
 * 构建封面图生成命令（从视频提取第一帧）
 */
export function buildExtractFrameCommand(
  inputVideo: string,
  outputImage: string,
  timeSeconds: number = 0.5,
): string[] {
  return [
    '-y',
    '-i', inputVideo,
    '-ss', String(timeSeconds),
    '-vframes', '1',
    '-q:v', '2',
    outputImage,
  ]
}

/**
 * 写入 FFmpeg concat 文件列表
 */
export function writeConcatFile(filePath: string, inputPaths: string[]): string {
  const content = inputPaths.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n')
  return content
}
