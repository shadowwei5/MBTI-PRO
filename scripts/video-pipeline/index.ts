// ============================================================
// MBTI-PRO Video Pipeline — CLI 主入口
// 录屏模式（默认）：Playwright 实时录屏 → WebM → FFmpeg 转 MP4
// 用法:
//   npx tsx index.ts --type ENFJ                    # 生成单个类型视频
//   npx tsx index.ts --batch --count 7               # 批量生成7个
//   npx tsx index.ts --type ENFJ --publish douyin    # 生成并发布
// ============================================================

import { existsSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { fetchTypeData, saveTypeData, getDailyTypeCode } from './fetch-type-data.js'
import { renderVideo } from './render-frames.js'
import { convertWebmToMp4, muxAudioAndSubtitles } from './compose-video.js'
import { generateVoiceover, getIntroVideoScript, getDailyTypeScript } from './generate-audio.js'
import { generateDefaultCover, generateTypeCover } from './generate-cover.js'
import type { FrameRenderConfig, Platform } from './types.js'

// 路径常量
const ROOT_DIR = join(import.meta.dirname, '..', '..')
const VIDEO_DIR = join(ROOT_DIR, 'video')
const OUTPUT_DIR = join(VIDEO_DIR, 'output')
const WORK_DIR = join(VIDEO_DIR, 'work')

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

interface CliOptions {
  typeCode?: string
  batch: boolean
  count: number
  publish?: Platform[]
  dryRun: boolean
  template: 'daily-type' | 'intro-video'
  duration: number
}

function parseArgs(args: string[]): CliOptions {
  const opts: CliOptions = {
    batch: false,
    count: 7,
    dryRun: false,
    template: 'daily-type',
    duration: 30,
  }

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--type': opts.typeCode = args[++i]; break
      case '--batch': opts.batch = true; break
      case '--count': opts.count = parseInt(args[++i], 10); break
      case '--publish': opts.publish = args[++i]?.split(',') as Platform[]; break
      case '--dry-run': opts.dryRun = true; break
      case '--template': opts.template = args[++i] as 'daily-type' | 'intro-video'; break
      case '--duration': opts.duration = parseInt(args[++i], 10); break
    }
  }

  return opts
}

async function generateForType(typeCode: string, opts: CliOptions): Promise<string> {
  const code = typeCode.toUpperCase()
  console.log(`\n🎬 生成视频: ${code} (${opts.template}, ${opts.duration}s)`)

  // Step 1: 获取数据
  const workDir = join(WORK_DIR, code)
  ensureDir(workDir)

  let data
  const localPath = join(workDir, `${code}.json`)
  if (existsSync(localPath)) {
    data = JSON.parse(readFileSync(localPath, 'utf-8'))
    console.log(`  [1/3] 本地数据: ${data.code} ${data.name}`)
  } else {
    data = await fetchTypeData(code)
    saveTypeData(code, data, workDir)
    console.log(`  [1/3] API 获取: ${data.code} ${data.name}`)
  }

  // Step 2: Playwright 录屏
  const videoDir = join(workDir, 'recording')
  ensureDir(videoDir)

  const frameConfig: FrameRenderConfig = {
    typeCode: code,
    outputDir: videoDir,
    width: 1080,
    height: 1920,
    fps: 30,
    durationSeconds: opts.duration,
    keyframeInterval: 3,
    template: opts.template,
  }

  // 配音脚本
  const voiceScript = opts.template === 'intro-video'
    ? getIntroVideoScript()
    : getDailyTypeScript(data)

  console.log(`  [2/4] Playwright 录屏 (${opts.duration}s)...`)
  const webmPath = await renderVideo(frameConfig, data)

  // Step 3: TTS 配音 + 字幕
  console.log(`  [3/4] TTS 配音+字幕生成...`)
  const audioDir = join(workDir, 'audio')
  const { audioPath, subtitlePath } = await generateVoiceover(voiceScript, audioDir, code)

  // Step 4: WebM → MP4 + 音频 + 封面
  ensureDir(OUTPUT_DIR)
  const tempMp4 = join(OUTPUT_DIR, `${code}_${opts.template}_novoice.mp4`)
  const outputPath = join(OUTPUT_DIR, `${code}_${opts.template}.mp4`)
  const coverPath = join(OUTPUT_DIR, `cover_${code}.png`)
  console.log(`  [4/5] 合成: 视频+音频...`)
  await convertWebmToMp4(webmPath, tempMp4, 1080, 1920)
  await muxAudioAndSubtitles(tempMp4, audioPath, '', outputPath)
  try { unlinkSync(tempMp4) } catch {}
  try { unlinkSync(subtitlePath) } catch {}
  console.log(`  [5/5] 生成封面: ${code}...`)
  await generateTypeCover(data)

  console.log(`  ✅ ${outputPath}`)
  console.log(`  🖼 ${coverPath}`)
  return outputPath
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))

  ensureDir(OUTPUT_DIR)
  ensureDir(WORK_DIR)

  if (!opts.typeCode && !opts.batch) {
    console.log('🎬 MBTI-PRO Video Pipeline')
    console.log('')
    console.log('用法:')
    console.log('  npx tsx index.ts --type ENFJ                 生成单个类型视频')
    console.log('  npx tsx index.ts --batch --count 7           批量生成7个')
    console.log('  npx tsx index.ts --type ENFJ --template intro-video  生成介绍视频')
    console.log('  npx tsx index.ts --type ENFJ --publish douyin  生成并发布到抖音')
    console.log('')
    console.log('可用选项:')
    console.log('  --type <CODE>     类型代码 (ENFJ, INTP, ...)')
    console.log('  --batch           批量模式')
    console.log('  --count <N>       批量数量 (默认7)')
    console.log('  --duration <S>    视频时长秒数 (默认30)')
    console.log('  --publish <P>     发布平台 (douyin,bilibili,xiaohongshu,wechat)')
    console.log('  --dry-run         模拟运行，不实际生成')
    console.log('  --template <T>    模板 (daily-type | intro-video)')
    process.exit(0)
  }

  const codes: string[] = []
  if (opts.batch) {
    const today = Math.floor(Date.now() / (1000 * 60 * 60 * 24))
    for (let i = 0; i < opts.count; i++) {
      codes.push(getDailyTypeCode(today + i))
    }
    console.log(`[video-pipeline] 批量模式: ${codes.length} 个类型`)
    console.log(`[video-pipeline] 类型: ${codes.join(', ')}`)
  } else if (opts.typeCode) {
    codes.push(opts.typeCode)
  }

  if (opts.dryRun) {
    console.log('[video-pipeline] 🏃 dry-run 模式，不实际生成')
    for (const code of codes) {
      console.log(`  将生成: ${code}`)
    }
    return
  }

  const results: string[] = []
  for (const code of codes) {
    try {
      const path = await generateForType(code, opts)
      results.push(path)
    } catch (err) {
      console.error(`[video-pipeline] ❌ ${code}:`, err)
    }
  }

  console.log(`\n🎉 完成! 生成 ${results.length}/${codes.length} 个视频`)

  if (opts.publish && results.length > 0) {
    console.log(`\n📤 待发布到: ${opts.publish.join(', ')}`)
    console.log('（请配置 douyin-mcp-server 或 HuiMei MCP 后自动发布）')
  }
}

main().catch(console.error)
