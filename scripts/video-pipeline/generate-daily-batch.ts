// ============================================================
// MBTI-PRO Video Pipeline — 每日人格批量生成器
//
// 用途：固化已审核通过的每日视频/封面工作流，按发布队列生成剩余人格。
// 不调用付费 AI：仅补齐本地 API 数据缓存，然后复用 generate-approved-daily.ts 的 2K 高清逐帧流程。
// ============================================================

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { getAllNineGroups } from './utils/colors.js'

const ROOT_DIR = resolve(import.meta.dirname, '..', '..')
const PIPELINE_DIR = join(ROOT_DIR, 'scripts', 'video-pipeline')
const VIDEO_DIR = join(ROOT_DIR, 'video')
const OUTPUT_DIR = join(VIDEO_DIR, 'output')
const WORK_DIR = join(VIDEO_DIR, 'work')
const CONTENT_DIR = join(ROOT_DIR, 'content-marketing')
const CALENDAR_PATH = join(CONTENT_DIR, 'publish-calendar.json')
const APPROVED_SAMPLE_CODE = 'ENFJ'

const TRADITIONAL_PRIORITY = [
  'ENFJ', 'INFP', 'ENFP', 'INTP', 'INTJ', 'INFJ', 'ENTP', 'ENTJ',
  'ISFP', 'ESFP', 'ISTP', 'ESTP', 'ISFJ', 'ESFJ', 'ISTJ', 'ESTJ',
]

interface BatchOptions {
  count: number
  dryRun: boolean
  force: boolean
  initCalendar: boolean
  startCode?: string
  explicitCodes: string[]
  apiBase?: string
}

interface PublishStatus {
  generated: boolean
  reviewed: boolean
  predicted: boolean
  draftPrepared: boolean
  uploadedDraft: boolean
  published: boolean
  retroDone: boolean
}

interface PlatformState {
  enabled: boolean
  url: string | null
  publishedAt: string | null
  metricsCapturedAt: string | null
}

interface CalendarItem {
  order: number
  code: string
  name: string | null
  phase: 'approved-sample' | 'traditional-first' | 'new-81-type'
  videoPath: string
  coverPath: string
  scriptPath: string | null
  predictionPath: string | null
  plannedPublishDate: string | null
  generatedAt: string | null
  reviewedAt: string | null
  retroDueAt: string | null
  status: PublishStatus
  platforms: {
    douyin: PlatformState
    xiaohongshu: PlatformState
    bilibili: PlatformState
  }
  notes: string
}

interface PublishCalendar {
  schemaVersion: 1
  updatedAt: string
  cadence: 'daily'
  primaryPlatform: 'douyin'
  secondaryPlatforms: Array<'xiaohongshu' | 'bilibili'>
  approvedSample: {
    code: string
    videoPath: string
    coverPath: string
  }
  workflowDocs: string[]
  items: CalendarItem[]
}

function ensureDir(dirPath: string) {
  if (!existsSync(dirPath)) mkdirSync(dirPath, { recursive: true })
}

function parseArgs(): BatchOptions {
  const args = process.argv.slice(2)
  const options: BatchOptions = {
    count: 1,
    dryRun: false,
    force: false,
    initCalendar: false,
    explicitCodes: [],
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--count') options.count = Math.max(1, Number(args[index + 1] || 1))
    if (arg === '--start') options.startCode = normalizeCode(args[index + 1])
    if (arg === '--types') options.explicitCodes = parseCodeList(args[index + 1] || '')
    if (arg === '--type') options.explicitCodes.push(normalizeCode(args[index + 1]))
    if (arg === '--api-base') options.apiBase = args[index + 1]
    if (arg === '--dry-run') options.dryRun = true
    if (arg === '--force') options.force = true
    if (arg === '--init-calendar') options.initCalendar = true
  }

  options.explicitCodes = [...new Set(options.explicitCodes.filter(Boolean))]
  return options
}

function normalizeCode(value = '') {
  return value.trim().toUpperCase()
}

function parseCodeList(value: string) {
  return value.split(',').map(normalizeCode).filter(Boolean)
}

function validateCode(code: string) {
  if (!/^[EAI][NBS][TCF][JDP]$/.test(code)) {
    throw new Error(`无效人格代码：${code}`)
  }
}

function getRemainingQueue() {
  const allCodes = getAllNineGroups().flatMap(group => group.types)
  const queue = [
    ...TRADITIONAL_PRIORITY.filter(code => code !== APPROVED_SAMPLE_CODE),
    ...allCodes.filter(code => code !== APPROVED_SAMPLE_CODE && !TRADITIONAL_PRIORITY.includes(code)),
  ]
  return [...new Set(queue)]
}

function outputVideoPath(code: string) {
  return join(OUTPUT_DIR, `${code}_daily_review.mp4`)
}

function outputCoverPath(code: string) {
  return join(OUTPUT_DIR, `cover_${code}_daily_review.png`)
}

function dataPath(code: string) {
  return join(WORK_DIR, code, `${code}.json`)
}

function readTypeName(code: string) {
  const path = dataPath(code)
  if (!existsSync(path)) return null
  try {
    const data = JSON.parse(readFileSync(path, 'utf-8')) as { name?: string }
    return data.name || null
  } catch {
    return null
  }
}

function makePlatformState(enabled: boolean): PlatformState {
  return {
    enabled,
    url: null,
    publishedAt: null,
    metricsCapturedAt: null,
  }
}

function makeItem(code: string, order: number): CalendarItem {
  const isApprovedSample = code === APPROVED_SAMPLE_CODE
  const isTraditional = TRADITIONAL_PRIORITY.includes(code)
  const generated = existsSync(outputVideoPath(code)) && existsSync(outputCoverPath(code))

  return {
    order,
    code,
    name: readTypeName(code),
    phase: isApprovedSample ? 'approved-sample' : isTraditional ? 'traditional-first' : 'new-81-type',
    videoPath: outputVideoPath(code),
    coverPath: outputCoverPath(code),
    scriptPath: null,
    predictionPath: null,
    plannedPublishDate: null,
    generatedAt: generated ? null : null,
    reviewedAt: isApprovedSample ? new Date().toISOString() : null,
    retroDueAt: null,
    status: {
      generated,
      reviewed: isApprovedSample,
      predicted: isApprovedSample,
      draftPrepared: false,
      uploadedDraft: false,
      published: false,
      retroDone: false,
    },
    platforms: {
      douyin: makePlatformState(true),
      xiaohongshu: makePlatformState(true),
      bilibili: makePlatformState(false),
    },
    notes: isApprovedSample ? '已通过用户审核的 ENFJ 每日视频/封面样片。' : '',
  }
}

function mergeItem(previous: CalendarItem | undefined, next: CalendarItem): CalendarItem {
  if (!previous) return next
  return {
    ...next,
    ...previous,
    order: next.order,
    phase: next.phase,
    videoPath: next.videoPath,
    coverPath: next.coverPath,
    name: previous.name || next.name,
    status: { ...next.status, ...previous.status },
    platforms: {
      douyin: { ...next.platforms.douyin, ...previous.platforms?.douyin },
      xiaohongshu: { ...next.platforms.xiaohongshu, ...previous.platforms?.xiaohongshu },
      bilibili: { ...next.platforms.bilibili, ...previous.platforms?.bilibili },
    },
  }
}

function loadCalendar(): PublishCalendar | null {
  if (!existsSync(CALENDAR_PATH)) return null
  return JSON.parse(readFileSync(CALENDAR_PATH, 'utf-8')) as PublishCalendar
}

function buildCalendar(): PublishCalendar {
  const previous = loadCalendar()
  const previousItems = new Map((previous?.items || []).map(item => [item.code, item]))
  const codes = [APPROVED_SAMPLE_CODE, ...getRemainingQueue()]
  const items = codes.map((code, index) => mergeItem(previousItems.get(code), makeItem(code, index)))

  return {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    cadence: 'daily',
    primaryPlatform: 'douyin',
    secondaryPlatforms: ['xiaohongshu', 'bilibili'],
    approvedSample: {
      code: APPROVED_SAMPLE_CODE,
      videoPath: outputVideoPath(APPROVED_SAMPLE_CODE),
      coverPath: outputCoverPath(APPROVED_SAMPLE_CODE),
    },
    workflowDocs: [
      join(CONTENT_DIR, 'VIDEO_PRODUCTION_WORKFLOW.md'),
      join(CONTENT_DIR, 'DAILY_80_QUEUE.md'),
      join(CONTENT_DIR, 'AUTO_PUBLISH_PLAN.md'),
    ],
    items,
  }
}

function saveCalendar(calendar: PublishCalendar) {
  ensureDir(CONTENT_DIR)
  calendar.updatedAt = new Date().toISOString()
  writeFileSync(CALENDAR_PATH, `${JSON.stringify(calendar, null, 2)}\n`, 'utf-8')
}

function selectCodes(calendar: PublishCalendar, options: BatchOptions) {
  const explicit = options.explicitCodes.filter(Boolean)
  const queue = explicit.length > 0 ? explicit : getRemainingQueue()
  for (const code of queue) validateCode(code)

  const startIndex = options.startCode ? queue.indexOf(options.startCode) : 0
  if (options.startCode && startIndex === -1) throw new Error(`队列中找不到 --start ${options.startCode}`)
  const ordered = startIndex > 0 ? queue.slice(startIndex) : queue

  const selected: string[] = []
  for (const code of ordered) {
    const item = calendar.items.find(entry => entry.code === code)
    const alreadyGenerated = item?.status.generated || (existsSync(outputVideoPath(code)) && existsSync(outputCoverPath(code)))
    if (!options.force && alreadyGenerated) continue
    selected.push(code)
    if (selected.length >= options.count) break
  }
  return selected
}

function runCommand(command: string, args: string[], env: NodeJS.ProcessEnv) {
  return new Promise<void>((resolveRun, rejectRun) => {
    const child = spawn(command, args, { cwd: PIPELINE_DIR, env, stdio: 'inherit', shell: false })
    child.on('error', rejectRun)
    child.on('close', code => {
      if (code === 0) resolveRun()
      else rejectRun(new Error(`${command} ${args.join(' ')} 退出码：${code}`))
    })
  })
}

async function ensureDataCache(code: string, options: BatchOptions) {
  if (existsSync(dataPath(code))) return
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
  const env = {
    ...process.env,
    MBTI_API_URL: options.apiBase || process.env.MBTI_API_URL || 'https://mbti-pro.com/api',
  }
  const relativeOutputDir = `../../video/work/${code}`
  console.log(`  [data] 补齐 ${code} 数据缓存：${env.MBTI_API_URL}`)
  await runCommand(npx, ['tsx', 'fetch-type-data.ts', code, relativeOutputDir], env)
}

async function generateDailyVideo(code: string, options: BatchOptions) {
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
  const env = { ...process.env }
  console.log(`  [render] 生成 ${code} 每日 2K 高清视频和封面`)
  await runCommand(npx, ['tsx', 'generate-approved-daily.ts', '--type', code, '--suffix', 'daily_review', '--quality', '2k'], env)
}

function markGenerated(calendar: PublishCalendar, code: string) {
  const item = calendar.items.find(entry => entry.code === code)
  if (!item) return
  item.name = readTypeName(code) || item.name
  item.videoPath = outputVideoPath(code)
  item.coverPath = outputCoverPath(code)
  item.generatedAt = new Date().toISOString()
  item.status.generated = existsSync(item.videoPath) && existsSync(item.coverPath)
}

async function main() {
  const options = parseArgs()
  ensureDir(OUTPUT_DIR)
  ensureDir(CONTENT_DIR)

  const calendar = buildCalendar()
  saveCalendar(calendar)

  if (options.initCalendar) {
    console.log(`✅ 发布台账已初始化：${CALENDAR_PATH}`)
    console.log(`   队列总数：${calendar.items.length}（含已审核样片 ${APPROVED_SAMPLE_CODE} + 剩余 80 条）`)
    return
  }

  const selectedCodes = selectCodes(calendar, options)
  if (selectedCodes.length === 0) {
    console.log('✅ 没有待生成的人格视频。可使用 --force 重新生成。')
    return
  }

  console.log(`📌 本次计划生成：${selectedCodes.join(', ')}`)
  if (options.dryRun) {
    console.log('🏃 dry-run：仅展示计划，不生成视频。')
    for (const code of selectedCodes) {
      console.log(`  npx tsx generate-approved-daily.ts --type ${code} --suffix daily_review --quality 2k`)
    }
    return
  }

  for (const code of selectedCodes) {
    console.log(`\n🎬 开始处理 ${code}`)
    await ensureDataCache(code, options)
    await generateDailyVideo(code, options)
    markGenerated(calendar, code)
    saveCalendar(calendar)
  }

  console.log(`\n✅ 批量生成完成，发布台账已更新：${CALENDAR_PATH}`)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})


