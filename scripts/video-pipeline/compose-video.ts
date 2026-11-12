// ============================================================
// MBTI-PRO Video Pipeline �� FFmpeg ��Ƶ�ϳ�����
// PNG ֡���� + ����Ч�� �� MP4 ��Ƶ
// ============================================================

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, writeFileSync, unlinkSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import type { ComposeConfig } from './types.js'

/** FFmpeg ������·������ @ffmpeg-installer/ffmpeg �ṩ�� */
const FFMPEG_PATH = ffmpegInstaller.path

interface MuxAudioOptions {
  bgmPath?: string
  bgmVolumeDb?: number
  width?: number
  height?: number
  videoCrf?: number
  videoBitrate?: string
  minrate?: string
  maxrate?: string
  bufsize?: string
  subtitleFontSize?: number
  subtitleMarginV?: number
  subtitleOutline?: number
  subtitleShadow?: number
  maxDurationSec?: number
}

/**
 * ��� FFmpeg �Ƿ����
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
 * ���� FFmpeg ����
 */
function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG_PATH, args, { stdio: 'inherit' })
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`FFmpeg �˳���: ${code}`))
    })
    proc.on('error', reject)
  })
}

/**
 * �� PNG ֡���кϳ�Ϊ MP4 ��Ƶ
 *
 * ���ԣ�
 * 1. ���֡�� >= Ŀ��֡�� �� ֱ�� concat��ÿ֡��ʾ�̶�ʱ����1/N��
 * 2. ���֡���� �� ʹ�� xfade �˾���֮֡�䴴��ƽ������
 * 3. ���� BGM������У�
 */
export async function composeVideo(config: ComposeConfig): Promise<string> {
  const {
    typeCode,
    framesDir,
    outputPath,
    width = 1440,
    height = 2560,
    fps = 30,
    bgmPath,
    transitionFrames = 15, // ����֡�� (0.5s @ 30fps)
    durationSeconds = 30,
  } = config

  // ��� FFmpeg
  const ffmpegOk = await checkFfmpeg()
  if (!ffmpegOk) {
    throw new Error('FFmpeg �����á��밲װ FFmpeg ��ȷ������ PATH �С�')
  }

  if (!existsSync(framesDir)) {
    throw new Error(`֡Ŀ¼������: ${framesDir}`)
  }

  // ȷ�����Ŀ¼����
  const outDir = dirname(outputPath)
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true })
  }

  // ��ȡ֡�ļ��б�
  const frameFiles = readdirSync(framesDir)
    .filter(f => f.endsWith('.png'))
    .sort()

  if (frameFiles.length === 0) {
    throw new Error(`֡Ŀ¼Ϊ��: ${framesDir}`)
  }

  console.log(`[compose] ����: ${frameFiles.length} ֡, ${width}x${height}`)
  console.log(`[compose] ���: ${outputPath}`)
  console.log(`[compose] ʱ��: ${durationSeconds}s @ ${fps}fps`)

  const totalTargetFrames = durationSeconds * fps

  if (frameFiles.length >= 10) {
    // ֡���㹻��ֱ���� concat demuxer
    // ����ÿ֡��ʾʱ��
    const framesPerImage = Math.floor(totalTargetFrames / frameFiles.length)

    // ���� concat �ļ��б��ÿ֡�ظ� framesPerImage �Σ�
    const concatLines: string[] = []
    for (const f of frameFiles) {
      const fullPath = join(framesDir, f).replace(/\\/g, '/')
      concatLines.push(`file '${fullPath}'`)
      concatLines.push(`duration ${(framesPerImage / fps).toFixed(3)}`)
    }
    // ���һ֡��Ҫ�����һ���Ա�֤ concat ��ȷ
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
    } else {
      args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '23')
      args.push('-pix_fmt', 'yuv420p')
    }

    args.push(outputPath)

    console.log(`[compose] FFmpeg concat (${concatLines.length / 2} segments)...`)
    await runFfmpeg(args)

    // ���� concat �ļ�
    try { require('fs').unlinkSync(concatFile) } catch {}
  } else {
    // ֡�����٣�ʹ�ü򵥵�֡���кϳ�
    const args = [
      '-y',
      '-framerate', String(fps / frameFiles.length), // ÿ֡����ʾ����
      '-i', join(framesDir, 'frame_%04d.png').replace(/\\/g, '/'),
    ]

    if (bgmPath && existsSync(bgmPath)) {
      args.push('-i', bgmPath)
      args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '23')
      args.push('-pix_fmt', 'yuv420p')
      args.push('-c:a', 'aac', '-b:a', '128k')
    } else {
      args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '23')
      args.push('-pix_fmt', 'yuv420p')
    }

    args.push('-t', String(durationSeconds))
    args.push(outputPath)

    console.log(`[compose] FFmpeg frames �� video...`)
    await runFfmpeg(args)
  }

  console.log(`[compose] ? ���: ${outputPath}`)
  return outputPath
}

/**
 * ����֡ PNG ���кϳ�Ϊ���� MP4��
 * Լ��֡�ļ���Ϊ frame_00001.png��frame_00002.png ...
 */
export async function composeFrameSequenceToMp4(
  framesDir: string,
  outputPath: string,
  fps = 30,
  options: { crf?: number; preset?: string } = {},
): Promise<string> {
  const ffmpegOk = await checkFfmpeg()
  if (!ffmpegOk) throw new Error('FFmpeg �����á��밲װ FFmpeg ��ȷ������ PATH �С�')
  if (!existsSync(framesDir)) throw new Error(`֡Ŀ¼������: ${framesDir}`)

  const frameFiles = readdirSync(framesDir).filter(file => /^frame_\d+\.png$/.test(file)).sort()
  if (frameFiles.length === 0) throw new Error(`֡Ŀ¼Ϊ��: ${framesDir}`)

  const outDir = dirname(outputPath)
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

  console.log(`[compose:frames] ���룺${frameFiles.length} ֡ @ ${fps}fps`)
  console.log(`[compose:frames] �����${outputPath}`)
  await runFfmpeg([
    '-y',
    '-framerate', String(fps),
    '-i', join(framesDir, 'frame_%05d.png').replace(/\\/g, '/'),
    '-c:v', 'libx264',
    '-preset', options.preset || 'slow',
    '-crf', String(options.crf ?? 16),
    '-r', String(fps),
    '-pix_fmt', 'yuv420p',
    '-shortest', '-movflags', '+faststart',
    outputPath,
  ])
  console.log(`[compose:frames] ? ��ɣ�${outputPath}`)
  return outputPath
}
/**
 * �ϳɿڲ���Ƶ + ��Ļ¼��
 */
export async function composeTalkingHead(
  talkingVideo: string,
  screencastVideo: string,
  outputPath: string,
  bgmPath?: string,
): Promise<string> {
  // �����˾�ͼ���ڲ���Ϊ�����棬¼����Ϊ���л�
  const filterComplex = [
    // ¼�����ŵ� 30% ���������½�
    `[1:v]scale=324:576[overlay]`,
    // ����
    `[0:v][overlay]overlay=W-w-30:H-h-30:enable='between(t,0,999)'[vout]`,
  ].join(';')

  const args = [
    '-y',
    '-i', talkingVideo,
    '-i', screencastVideo,
    '-filter_complex', filterComplex,
    '-map', '[vout]',
    '-map', '0:a', // ʹ�ÿڲ�����Ƶ
    '-c:v', 'libx264',
    '-preset', 'slow',
    '-r', '30',
    '-b:v', '10M',
    '-minrate', '9M',
    '-maxrate', '12M',
    '-bufsize', '24M',
    '-x264-params', 'nal-hrd=cbr:force-cfr=1:filler=1',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '128k',
  ]

  if (bgmPath && existsSync(bgmPath)) {
    args.push('-i', bgmPath)
    // ��� BGM���������� 60%��
    args.push('-filter_complex',
      filterComplex + `;[2:a]volume=0.4[bgm];[0:a][bgm]amix=inputs=2:duration=first[aout]`)
    args.push('-map', '[aout]')
  }

  args.push(outputPath)

  console.log(`[compose] �ڲ�+¼��ƴ�� �� ${outputPath}`)
  await runFfmpeg(args)
  console.log(`[compose] ? ���`)
  return outputPath
}

/**
 * �� Playwright ¼�Ƶ� WebM ת��Ϊ MP4 (H.264 + AAC)
 * ͬʱ���ŵ�Ŀ��ֱ���
 */
export async function convertWebmToMp4(
  webmPath: string,
  outputPath: string,
  width: number = 1440,
  height: number = 2560,
  videoKbps: number = 24000,
): Promise<string> {
  if (!existsSync(webmPath)) {
    throw new Error(`WebM �ļ�������: ${webmPath}`)
  }

  const outDir = dirname(outputPath)
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

  console.log(`[compose:convert] WebM �� MP4`)
  console.log(`  ����: ${webmPath}`)
  console.log(`  ���: ${outputPath} (${width}x${height})`)

  const args = [
    '-y',
    '-i', webmPath,
    '-vf', `scale=${width}:${height}:flags=lanczos:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,unsharp=5:5:0.9:3:3:0.4`,
    '-c:v', 'libx264',
    '-preset', 'slow',
    '-r', '30',
    '-b:v', videoKbps + 'k',
    '-minrate', '14M',
    '-maxrate', '24M',
    '-bufsize', '48M',
    '-x264-params', 'nal-hrd=cbr:force-cfr=1:filler=1',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-shortest', '-movflags', '+faststart',
    outputPath,
  ]

  await runFfmpeg(args)
  console.log(`[compose:convert] ? ���: ${outputPath}`)
  return outputPath
}

/**
 * ����Ƶ + ��Ƶ + ��Ļ�ϳ�Ϊ���ճ�Ʒ
 */
export async function muxAudioAndSubtitles(
  videoPath: string,
  audioPath: string,
  subtitlePath: string,
  outputPath: string,
  options: MuxAudioOptions = {},
): Promise<string> {
  if (!existsSync(videoPath)) throw new Error(`��Ƶ������: ${videoPath}`)
  if (!existsSync(audioPath)) throw new Error(`��Ƶ������: ${audioPath}`)

  const hasSubtitles = subtitlePath && existsSync(subtitlePath)
  const hasBgm = options.bgmPath && existsSync(options.bgmPath)

  const outDir = dirname(outputPath)
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

  if (hasSubtitles) {
    console.log(`[compose:mux] �ϳ�����Ƶ+��Ļ`)
    console.log(`  ��Ļ: ${subtitlePath}`)
  } else {
    console.log(`[compose:mux] �ϳ�����Ƶ (����Ļ)`)
  }
  console.log(`  ��Ƶ: ${videoPath}`)
  console.log(`  ��Ƶ: ${audioPath}`)
  if (hasBgm) console.log(`  BGM: ${options.bgmPath} (${options.bgmVolumeDb ?? -22}dB)`)

  const args = [
    '-y',
    '-i', videoPath,
    '-i', audioPath,
  ]

  if (hasBgm) {
    args.push('-stream_loop', '-1', '-i', options.bgmPath!)
  }

  let subtitleFilter = ''
  if (hasSubtitles) {
    const assPath = join(dirname(outputPath), '_temp_sub.ass')
    writeFileSync(assPath, srtToAss(readFileSync(subtitlePath, 'utf-8'), options), 'utf-8')
    const safeAssPath = assPath.replace(/\\/g, '/').replace(/^([A-Za-z]):/, '$1\\:')
    subtitleFilter = `ass='${safeAssPath}'`
  }

  if (hasBgm) {
    const bgmVolume = dbToLinear(options.bgmVolumeDb ?? -22)
    const filters: string[] = []
    if (subtitleFilter) filters.push(`[0:v]${subtitleFilter}[vout]`)
    filters.push(`[1:a]volume=1[a_voice];[2:a]volume=${bgmVolume.toFixed(4)},afade=t=in:st=0:d=0.5[a_bgm];[a_voice][a_bgm]amix=inputs=2:duration=first:dropout_transition=0[aout]`)
    args.push('-filter_complex', filters.join(';'))
    args.push('-map', subtitleFilter ? '[vout]' : '0:v:0', '-map', '[aout]')
  } else {
    if (subtitleFilter) args.push('-vf', subtitleFilter)
    args.push('-map', '0:v:0', '-map', '1:a:0')
  }

  args.push('-c:v', 'libx264', '-preset', 'slow', '-r', '30')
  if (options.videoCrf !== undefined) {
    args.push('-crf', String(options.videoCrf))
  } else {
    args.push(
      '-b:v', options.videoBitrate || '14M',
      '-minrate', options.minrate || '12M',
      '-maxrate', options.maxrate || '18M',
      '-bufsize', options.bufsize || '36M',
      '-x264-params', 'nal-hrd=cbr:force-cfr=1:filler=1',
    )
  }
  args.push(
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '160k',
    '-shortest', '-movflags', '+faststart',
  )
  if (options.maxDurationSec && Number.isFinite(options.maxDurationSec)) {
    args.push('-t', String(options.maxDurationSec))
  }
  args.push(outputPath)

  await runFfmpeg(args)
  if (hasSubtitles) {
    const assPath = join(dirname(outputPath), '_temp_sub.ass')
    try { unlinkSync(assPath) } catch {}
  }
  console.log(`[compose:mux] ? ���: ${outputPath}`)
  return outputPath
}

function dbToLinear(db: number): number {
  return Math.pow(10, db / 20)
}


function srtToAss(srt: string, options: MuxAudioOptions = {}): string {
  const blocks = srt
    .replace(/\r/g, '')
    .split(/\n\s*\n/)
    .map(block => block.trim())
    .filter(Boolean)

  const dialogues = blocks.flatMap((block) => {
    const lines = block.split('\n')
    const timeLineIndex = lines.findIndex(line => line.includes('-->'))
    if (timeLineIndex < 0) return []

    const [startRaw, endRaw] = lines[timeLineIndex].split('-->').map(part => part.trim())
    const text = lines.slice(timeLineIndex + 1).join('\\N').trim()
    if (!text) return []

    return `Dialogue: 0,${srtTimeToAss(startRaw)},${srtTimeToAss(endRaw)},Default,,0,0,0,,${escapeAssText(text)}`
  })

  const width = options.width || 1080
  const height = options.height || 1920
  const scale = width / 1080
  const fontSize = options.subtitleFontSize || Math.round(66 * scale)
  const margin = Math.round(46 * scale)
  const marginV = options.subtitleMarginV || Math.round(210 * scale)
  const outline = options.subtitleOutline || Math.round(6 * scale)
  const shadow = options.subtitleShadow || Math.max(1, Math.round(1 * scale))

  return `[Script Info]
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Microsoft YaHei UI,${fontSize},&H00FFFFFF,&H00FFFFFF,&H00000000,&HA6000000,-1,0,0,0,100,100,0,0,1,${outline},${shadow},2,${margin},${margin},${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${dialogues.join('\n')}
`
}
function srtTimeToAss(value: string): string {
  const match = value.match(/(\d+):(\d+):(\d+),(\d+)/)
  if (!match) return '0:00:00.00'
  const hours = Number(match[1])
  const minutes = match[2]
  const seconds = match[3]
  const centiseconds = match[4].slice(0, 2).padEnd(2, '0')
  return `${hours}:${minutes}:${seconds}.${centiseconds}`
}

function escapeAssText(value: string): string {
  return value
    .replace(/[{}]/g, '')
    .replace(/\n/g, '\\N')
}









