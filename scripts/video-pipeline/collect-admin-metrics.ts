// MBTI-PRO — Website admin metrics collector
// Fetches MBTI-PRO admin stats and saves a snapshot for post-publish retro.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT_DIR = resolve(import.meta.dirname, '..', '..')
const CONTENT_DIR = join(ROOT_DIR, 'content-marketing')
const LOG_DIR = join(CONTENT_DIR, 'automation', 'metrics')
const DEFAULT_BASE_URL = 'https://mbti-pro.com'

interface Options {
  baseUrl: string
  label: string
  output?: string
  timeoutMs: number
}

interface AdminStatsResponse {
  success?: boolean
  data?: AdminStats
  [key: string]: unknown
}

interface AdminStats {
  overview?: Record<string, number | string | null>
  typeDistribution?: Array<Record<string, number | string | null>>
  todayTypeDistribution?: Array<Record<string, number | string | null>>
  topLiked?: Array<Record<string, number | string | null>>
  topDisliked?: Array<Record<string, number | string | null>>
  dailyTrend?: Array<Record<string, number | string | null>>
  utmSources?: Array<Record<string, number | string | null>>
  [key: string]: unknown
}

function ensureDir(path: string) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true })
}

function sanitizeLabel(label: string) {
  return label.replace(/[^a-zA-Z0-9_\-\u4e00-\u9fa5]/g, '_').slice(0, 80) || 'latest'
}

function timestampForFile() {
  return new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)
}

function parseArgs(): Options {
  const args = process.argv.slice(2)
  const options: Options = {
    baseUrl: process.env.MBTIPRO_ADMIN_BASE_URL || DEFAULT_BASE_URL,
    label: 'latest',
    timeoutMs: 20_000,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--base-url') options.baseUrl = args[index + 1] || DEFAULT_BASE_URL
    if (arg === '--label') options.label = sanitizeLabel(args[index + 1] || 'latest')
    if (arg === '--output') options.output = args[index + 1]
    if (arg === '--timeout') options.timeoutMs = Math.max(3_000, Number(args[index + 1] || 20) * 1000)
  }

  options.baseUrl = options.baseUrl.replace(/\/+$/, '')
  return options
}

async function fetchJson(url: string, timeoutMs: number): Promise<AdminStatsResponse> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: 'application/json', 'user-agent': 'mbti-pro-retro/1.0' },
    })
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`)
    return (await response.json()) as AdminStatsResponse
  } finally {
    clearTimeout(timeout)
  }
}

function saveSnapshot(options: Options, url: string, raw: AdminStatsResponse) {
  ensureDir(LOG_DIR)
  const admin = (raw.data || raw) as AdminStats
  const collectedAt = new Date().toISOString()
  const snapshot = {
    kind: 'admin-stats',
    label: options.label,
    collectedAt,
    url,
    admin,
    raw,
  }
  const output = options.output || join(LOG_DIR, `admin_${options.label}_${timestampForFile()}.json`)
  writeFileSync(output, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf-8')
  return { output, snapshot }
}

function printSummary(output: string, admin: AdminStats) {
  console.log(`\n✅ 网站后台数据采集完成：${output}`)
  console.log(JSON.stringify({ overview: admin.overview || {}, utmSources: admin.utmSources || [] }, null, 2))
}

async function main() {
  const options = parseArgs()
  const url = `${options.baseUrl}/api/admin/stats`
  const raw = await fetchJson(url, options.timeoutMs)
  const { output, snapshot } = saveSnapshot(options, url, raw)
  printSummary(output, snapshot.admin as AdminStats)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
