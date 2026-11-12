// ============================================================
// MBTI-PRO — 抖音/小红书半自动发布 Adapter
//
// 安全边界：
// - 默认只准备发布草稿、平台文案和资产路径。
// - 可选择打开平台上传页。
// - 不自动点击“发布”，必须人工最终确认。
// ============================================================

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import type { Platform } from './types.js'

const ROOT_DIR = resolve(import.meta.dirname, '..', '..')
const VIDEO_DIR = join(ROOT_DIR, 'video')
const WORK_DIR = join(VIDEO_DIR, 'work')
const OUTPUT_DIR = join(VIDEO_DIR, 'output')
const CONTENT_DIR = join(ROOT_DIR, 'content-marketing')
const AUTOMATION_DIR = join(CONTENT_DIR, 'automation')
const DRAFT_DIR = join(AUTOMATION_DIR, 'drafts')
const LOG_DIR = join(AUTOMATION_DIR, 'logs')
const PLATFORM_VARIANTS_DIR = join(CONTENT_DIR, 'platform-variants')
const CALENDAR_PATH = join(CONTENT_DIR, 'publish-calendar.json')

const SUPPORTED_PLATFORMS = ['douyin', 'xiaohongshu'] as const
type SemiAutoPlatform = typeof SUPPORTED_PLATFORMS[number]
type ContentKind = 'daily' | 'pinned'

interface Options {
  typeCode?: string
  kind: ContentKind
  platforms: SemiAutoPlatform[]
  open: boolean
  dryRun: boolean
  markDraft: boolean
}

interface TypeData {
  code: string
  name: string
  overview?: string
  strengths?: string[]
  growthAreas?: string[]
  population?: string | null
  _groupCode?: string
}

interface PlatformCopy {
  platform: SemiAutoPlatform
  title: string
  description: string
  hashtags: string[]
  firstComment: string
  publishUrl: string
}

interface PreparedDraft {
  id: string
  preparedAt: string
  kind: ContentKind
  typeCode: string
  typeName: string
  videoPath: string
  coverPath: string
  copies: PlatformCopy[]
  safety: {
    autoPublish: false
    finalClickRequiresHuman: true
  }
}

function ensureDir(dirPath: string) {
  if (!existsSync(dirPath)) mkdirSync(dirPath, { recursive: true })
}

function parseArgs(): Options {
  const args = process.argv.slice(2)
  const options: Options = {
    kind: 'daily',
    platforms: ['douyin', 'xiaohongshu'],
    open: false,
    dryRun: false,
    markDraft: true,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--type') options.typeCode = (args[index + 1] || '').toUpperCase()
    if (arg === '--kind') options.kind = (args[index + 1] || 'daily') as ContentKind
    if (arg === '--platforms') options.platforms = parsePlatforms(args[index + 1] || '')
    if (arg === '--platform') options.platforms = parsePlatforms(args[index + 1] || '')
    if (arg === '--open') options.open = true
    if (arg === '--dry-run') options.dryRun = true
    if (arg === '--no-mark-draft') options.markDraft = false
  }

  if (options.kind === 'daily' && !options.typeCode) {
    options.typeCode = pickNextGeneratedUnpublishedCode()
  }
  if (options.kind === 'pinned' && !options.typeCode) {
    options.typeCode = 'MBTI-PRO'
  }

  return options
}

function parsePlatforms(value: string): SemiAutoPlatform[] {
  const platforms = value.split(',').map(item => item.trim()).filter(Boolean) as SemiAutoPlatform[]
  const invalid = platforms.filter(platform => !SUPPORTED_PLATFORMS.includes(platform))
  if (invalid.length > 0) throw new Error(`暂不支持平台：${invalid.join(', ')}。当前支持：${SUPPORTED_PLATFORMS.join(', ')}`)
  return platforms.length > 0 ? [...new Set(platforms)] : ['douyin', 'xiaohongshu']
}

function pickNextGeneratedUnpublishedCode() {
  const calendar = loadCalendar()
  const item = calendar?.items?.find((entry: any) => entry.status?.generated && !entry.status?.published)
  return item?.code || 'ENFJ'
}

function loadCalendar(): any | null {
  if (!existsSync(CALENDAR_PATH)) return null
  return JSON.parse(readFileSync(CALENDAR_PATH, 'utf-8'))
}

function saveCalendar(calendar: any) {
  calendar.updatedAt = new Date().toISOString()
  writeFileSync(CALENDAR_PATH, `${JSON.stringify(calendar, null, 2)}\n`, 'utf-8')
  const recordsPath = join(CONTENT_DIR, 'records', 'publish-calendar.json')
  ensureDir(join(CONTENT_DIR, 'records'))
  writeFileSync(recordsPath, `${JSON.stringify(calendar, null, 2)}\n`, 'utf-8')
}

function loadTypeData(code: string): TypeData {
  if (code === 'MBTI-PRO') {
    return {
      code: 'MBTI-PRO',
      name: '81型人格测试',
      overview: '把传统 16 型人格扩展成更细腻的 81 型人格，识别那些被中间态忽略的人。',
      strengths: ['更细分', '更像你', '更适合分享'],
      growthAreas: ['别再被单一标签限制'],
    }
  }

  const dataPath = join(WORK_DIR, code, `${code}.json`)
  if (!existsSync(dataPath)) throw new Error(`缺少人格数据：${dataPath}。请先生成该人格视频或运行 fetch-type-data。`)
  return JSON.parse(readFileSync(dataPath, 'utf-8')) as TypeData
}

function requireFile(path: string, label: string) {
  if (!existsSync(path)) throw new Error(`缺少${label}：${path}`)
  return path
}

function getMediaPaths(kind: ContentKind, code: string) {
  if (kind === 'pinned') {
    return {
      videoPath: requireFile(join(OUTPUT_DIR, 'MBTI-PRO_pinned_review.mp4'), '置顶视频'),
      coverPath: requireFile(join(OUTPUT_DIR, 'cover_MBTI-PRO_pinned_review.png'), '置顶封面'),
    }
  }

  return {
    videoPath: requireFile(join(OUTPUT_DIR, `${code}_daily_review.mp4`), '每日视频'),
    coverPath: requireFile(join(OUTPUT_DIR, `cover_${code}_daily_review.png`), '每日封面'),
  }
}

function compactText(text = '', maxLength = 72) {
  const normalized = String(text).replace(/\s+/g, ' ').trim()
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}…` : normalized
}

function buildPlatformCopy(typeData: TypeData, kind: ContentKind, platform: SemiAutoPlatform): PlatformCopy {
  const isPinned = kind === 'pinned'
  const code = typeData.code
  const name = typeData.name
  const strength = compactText(typeData.strengths?.[0] || '你以为的性格标签，其实还有更细的一层', 34)
  const growth = compactText(typeData.growthAreas?.[0] || '别再用一个粗标签解释自己', 34)
  const overview = compactText(typeData.overview || '', platform === 'douyin' ? 60 : 90)

  if (platform === 'douyin') {
    return {
      platform,
      title: isPinned ? 'MBTI只说中一半？试试81型人格' : `${code} ${name}：你身边有没有这样一个人？`,
      description: isPinned
        ? `传统16型不够细？MBTI-PRO 把人格拆成81型：更像你，也更适合分享。主页免费测试。\n#MBTI #人格测试 #心理测试 #自我认知 #MBTI_PRO`
        : `你身边有没有这样一个 ${code}？${overview}\n他的优势是：${strength}。但也容易卡在：${growth}。\n16型说中大方向，81型补上中间地带。主页免费测试。\n#MBTI #人格测试 #${code} #性格分析 #自我认知`,
      hashtags: isPinned ? ['MBTI', '人格测试', '心理测试', '自我认知', 'MBTI_PRO'] : ['MBTI', '人格测试', code, '性格分析', '自我认知'],
      firstComment: '测完回来告诉我：你的 81 型人格是哪一个？',
      publishUrl: 'https://creator.douyin.com/creator-micro/content/upload',
    }
  }

  return {
    platform,
    title: isPinned ? 'MBTI 只说中一半的人，建议试试 81 型人格' : `${code}｜${name} 的真实人格画像`,
    description: isPinned
      ? `如果你总觉得传统 MBTI 有点像、但又不完全像，可能不是你不典型，而是 16 型太粗了。\n\nMBTI-PRO 把人格扩展成 81 型，尤其适合那些卡在中间态的人。\n\n主页免费测试。\n\n#MBTI #人格测试 #心理测试 #自我认知 #MBTI_PRO`
      : `你身边有没有这样一个 ${code}？\n\n${overview}\n\n他的闪光点：${strength}\n他的隐藏卡点：${growth}\n\n传统 16 型说中大方向，81 型会把中间态讲清楚。主页免费测试。\n\n#MBTI #人格测试 #${code} #性格分析 #自我认知`,
    hashtags: isPinned ? ['MBTI', '人格测试', '心理测试', '自我认知', 'MBTI_PRO'] : ['MBTI', '人格测试', code, '性格分析', '自我认知'],
    firstComment: '想看哪个人格？评论区告诉我代码。',
    publishUrl: 'https://creator.xiaohongshu.com/publish/publish',
  }
}

function buildDraft(options: Options): PreparedDraft {
  if (!options.typeCode) throw new Error('缺少 --type')
  const typeData = loadTypeData(options.typeCode)
  const media = getMediaPaths(options.kind, options.typeCode)
  const id = `${new Date().toISOString().slice(0, 10)}_${options.kind}_${options.typeCode}`

  return {
    id,
    preparedAt: new Date().toISOString(),
    kind: options.kind,
    typeCode: options.typeCode,
    typeName: typeData.name,
    videoPath: media.videoPath,
    coverPath: media.coverPath,
    copies: options.platforms.map(platform => buildPlatformCopy(typeData, options.kind, platform)),
    safety: {
      autoPublish: false,
      finalClickRequiresHuman: true,
    },
  }
}

function writeDraftFiles(draft: PreparedDraft) {
  ensureDir(DRAFT_DIR)
  ensureDir(LOG_DIR)
  ensureDir(PLATFORM_VARIANTS_DIR)
  const jsonPath = join(DRAFT_DIR, `${draft.id}.json`)
  const mdPath = join(DRAFT_DIR, `${draft.id}.md`)
  writeFileSync(jsonPath, `${JSON.stringify(draft, null, 2)}\n`, 'utf-8')

  const lines = [
    `# 发布草稿：${draft.typeCode} ${draft.typeName}`,
    '',
    `- 类型：${draft.kind}`,
    `- 准备时间：${draft.preparedAt}`,
    `- 视频：\`${draft.videoPath}\``,
    `- 封面：\`${draft.coverPath}\``,
    `- 安全边界：不会自动点击发布，必须人工确认。`,
    '',
  ]

  for (const copy of draft.copies) {
    lines.push(`## ${copy.platform}`)
    lines.push('')
    lines.push(`- 上传页：[${copy.platform}](${copy.publishUrl})`)
    lines.push(`- 标题：${copy.title}`)
    lines.push(`- 标签：${copy.hashtags.map(tag => `#${tag}`).join(' ')}`)
    lines.push(`- 置顶/首评：${copy.firstComment}`)
    lines.push('')
    lines.push('```text')
    lines.push(copy.description)
    lines.push('```')
    lines.push('')
  }

  writeFileSync(mdPath, `${lines.join('\n')}\n`, 'utf-8')

  for (const copy of draft.copies) {
    const platformDir = join(PLATFORM_VARIANTS_DIR, copy.platform)
    ensureDir(platformDir)
    const platformMd = [
      `# ${copy.platform} ?????${draft.typeCode} ${draft.typeName}`,
      '',
      `- ???${copy.title}`,
      `- ???\`${draft.videoPath}\``,
      `- ???\`${draft.coverPath}\``,
      `- ???${copy.hashtags.map(tag => `#${tag}`).join(' ')}`,
      `- ???${copy.firstComment}`,
      '',
      '```text',
      copy.description,
      '```',
      '',
    ].join('\n')
    writeFileSync(join(platformDir, `${draft.id}.md`), platformMd, 'utf-8')
  }

  writeFileSync(join(LOG_DIR, `${draft.id}.prepared.log`), `prepared ${draft.id} at ${draft.preparedAt}\n`, 'utf-8')
  return { jsonPath, mdPath }
}

function markDraftPrepared(draft: PreparedDraft, draftPaths: { jsonPath: string; mdPath: string }) {
  const calendar = loadCalendar()
  if (!calendar?.items || draft.typeCode === 'MBTI-PRO') return
  const item = calendar.items.find((entry: any) => entry.code === draft.typeCode)
  if (!item) return
  item.status = item.status || {}
  item.status.draftPrepared = true
  item.scriptPath = item.scriptPath || draftPaths.mdPath
  item.videoPath = draft.videoPath
  item.coverPath = draft.coverPath
  item.notes = [item.notes, `发布草稿已准备：${draftPaths.mdPath}`].filter(Boolean).join('\n')
  saveCalendar(calendar)
}

function openUrl(url: string) {
  const command = process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open'
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url]
  spawn(command, args, { detached: true, stdio: 'ignore', shell: false }).unref()
}

function printSummary(draft: PreparedDraft, draftPaths: { jsonPath: string; mdPath: string }) {
  console.log('\n✅ 半自动发布草稿已准备')
  console.log(`  草稿 Markdown: ${draftPaths.mdPath}`)
  console.log(`  草稿 JSON:     ${draftPaths.jsonPath}`)
  console.log(`  视频:          ${draft.videoPath}`)
  console.log(`  封面:          ${draft.coverPath}`)
  for (const copy of draft.copies) {
    console.log(`\n[${copy.platform}]`)
    console.log(`  上传页: ${copy.publishUrl}`)
    console.log(`  标题:   ${copy.title}`)
    console.log(`  标签:   ${copy.hashtags.map(tag => `#${tag}`).join(' ')}`)
  }
  console.log('\n⚠️  已按安全策略停止在发布前：不会自动点击发布。')
}

async function main() {
  const options = parseArgs()
  const draft = buildDraft(options)
  const draftPaths = writeDraftFiles(draft)

  if (!options.dryRun && options.markDraft) markDraftPrepared(draft, draftPaths)

  printSummary(draft, draftPaths)

  if (options.open) {
    for (const copy of draft.copies) openUrl(copy.publishUrl)
    console.log('\n🌐 已打开平台上传页。请手动上传视频/封面并最终确认发布。')
  }
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
