// MBTI-PRO — Build a markdown retro report from collected metrics logs.
// Combines platform creator-center snapshots with MBTI-PRO website admin stats.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT_DIR = resolve(import.meta.dirname, '..', '..')
const CONTENT_DIR = join(ROOT_DIR, 'content-marketing')
const METRICS_DIR = join(CONTENT_DIR, 'automation', 'metrics')
const RETRO_DIR = join(CONTENT_DIR, 'automation', 'retros')
const XHS_STATUS_DIR = join(CONTENT_DIR, 'automation', 'xhs_status')  // XHS_STATUS_SECTION_v11

interface Options {
  label: string
  output?: string
}

interface PlatformSnapshot {
  platform: string
  collectedAt: string
  url: string
  parsed: Record<string, string | number | null>
  rawText?: string
  screenshotPath?: string
  warnings?: string[]
}

interface PlatformLog {
  path: string
  label: string
  snapshots: PlatformSnapshot[]
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

interface AdminLog {
  path: string
  label: string
  collectedAt: string
  url: string
  admin: AdminStats
}

interface LoadedLogs {
  platformLogs: PlatformLog[]
  adminLogs: AdminLog[]
  ignoredPaths: string[]
}

function parseArgs(): Options {
  const args = process.argv.slice(2)
  const options: Options = { label: 'latest' }
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--label') options.label = args[index + 1] || 'latest'
    if (args[index] === '--output') options.output = args[index + 1]
  }
  return options
}

function ensureDir(dirPath: string) {
  if (!existsSync(dirPath)) mkdirSync(dirPath, { recursive: true })
}

function loadLogs(label: string): LoadedLogs {
  const loaded: LoadedLogs = { platformLogs: [], adminLogs: [], ignoredPaths: [] }
  if (!existsSync(METRICS_DIR)) return loaded

  for (const name of readdirSync(METRICS_DIR).filter(item => item.endsWith('.json')).sort()) {
    if (label !== 'latest' && !name.includes(label)) continue
    const path = join(METRICS_DIR, name)
    const data = JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>

    if (Array.isArray(data.snapshots)) {
      loaded.platformLogs.push({
        path,
        label: String(data.label || name),
        snapshots: data.snapshots as PlatformSnapshot[],
      })
      continue
    }

    if (data.kind === 'admin-stats' || data.admin) {
      loaded.adminLogs.push({
        path,
        label: String(data.label || name),
        collectedAt: String(data.collectedAt || ''),
        url: String(data.url || ''),
        admin: (data.admin || data.data || {}) as AdminStats,
      })
      continue
    }

    loaded.ignoredPaths.push(path)
  }

  return loaded
}

function metricValue(parsed: Record<string, string | number | null>, primary: string, fallback?: string) {
  return parsed[primary] ?? (fallback ? parsed[fallback] : '') ?? ''
}

function valueText(value: unknown) {
  if (value === null || value === undefined || value === '') return '未读取到'
  return String(value)
}

function platformTableRows(logs: PlatformLog[]) {
  const rows = ['| 时间 | 平台 | 播放/浏览 | 点赞 | 评论 | 收藏 | 分享 | 状态 |', '|---|---|---:|---:|---:|---:|---:|---|']
  for (const log of logs) {
    for (const snapshot of log.snapshots) {
      const parsed = snapshot.parsed || {}
      rows.push(`| ${snapshot.collectedAt || ''} | ${snapshot.platform} | ${metricValue(parsed, 'plays', 'views')} | ${metricValue(parsed, 'likes')} | ${metricValue(parsed, 'comments')} | ${metricValue(parsed, 'collects')} | ${metricValue(parsed, 'shares')} | ${metricValue(parsed, 'status') || metricValue(parsed, 'publishedFlag')} |`)
    }
  }
  return rows.length > 2 ? rows.join('\n') : '暂无平台采集数据。'
}

function latestAdmin(logs: AdminLog[]) {
  return [...logs].sort((left, right) => left.collectedAt.localeCompare(right.collectedAt)).at(-1)
}

function adminOverviewTable(logs: AdminLog[]) {
  const rows = ['| 时间 | 总测试 | 今日测试 | 7日测试 | 邮箱/线索 | 今日邮箱 | 完成率 | 平均耗时 |', '|---|---:|---:|---:|---:|---:|---:|---:|']
  for (const log of logs) {
    const overview = log.admin.overview || {}
    rows.push(`| ${log.collectedAt || ''} | ${valueText(overview.totalTests)} | ${valueText(overview.todayTests)} | ${valueText(overview.weekTests)} | ${valueText(overview.totalEmails)} | ${valueText(overview.todayEmails)} | ${valueText(overview.completionRate)} | ${valueText(overview.avgDurationSec)} |`)
  }
  return rows.length > 2 ? rows.join('\n') : '暂无网站后台采集数据。'
}

function compactList(items: Array<Record<string, number | string | null>> | undefined, firstKey: string, secondKey: string, limit = 8) {
  if (!items?.length) return '- 未读取到'
  return items.slice(0, limit).map(item => `- ${valueText(item[firstKey])}：${valueText(item[secondKey])}`).join('\n')
}

function sourceList(logs: LoadedLogs) {
  const paths = [
    ...logs.platformLogs.map(log => log.path),
    ...logs.adminLogs.map(log => log.path),
  ]
  return paths.map(path => `- \`${path}\``).join('\n') || '- 暂无采集日志'
}



function xhsStatusSection() {  // // XHS_STATUS_SECTION_v11
  if (!existsSync(XHS_STATUS_DIR)) {
    return '未创建 xhs_status 目录，无小红书违规/审核截图。'
  }
  const entries = readdirSync(XHS_STATUS_DIR)
    .filter(n => !n.startsWith('_') && /\.(png|jpg|jpeg|md|txt)$/i.test(n))
    .sort()
  if (!entries.length) {
    return [
      '- 目录：`' + XHS_STATUS_DIR + '`',
      '- 状态：暂无提交截图。若小红书出现违规/限流提示，请在 App 截图并存入 `_INBOX/`。',
    ].join('\n')
  }
  return entries.map(name => '- `' + name + '`').join('\n')
}

function buildReport(logs: LoadedLogs) {
  const latestSnapshots = [...logs.platformLogs].reverse().flatMap(log => [...log.snapshots].reverse())
  const latestDouyin = latestSnapshots.find(item => item.platform === 'douyin')
  const latestXhs = latestSnapshots.find(item => item.platform === 'xiaohongshu')
  const admin = latestAdmin(logs.adminLogs)
  const adminData = admin?.admin || {}

  return `# 发布后数据复盘草稿

生成时间：${new Date().toISOString()}

## 数据来源

${sourceList(logs)}

${logs.ignoredPaths.length ? `## 未识别日志\n\n${logs.ignoredPaths.map(path => `- \`${path}\``).join('\n')}\n` : ''}## 平台指标

${platformTableRows(logs.platformLogs)}

## 网站转化指标

${adminOverviewTable(logs.adminLogs)}

### UTM 来源

${compactList(adminData.utmSources, 'source', 'count')}

### 今日人格测试分布

${compactList(adminData.todayTypeDistribution, 'code', 'count')}

### 最近趋势

${compactList(adminData.dailyTrend, 'date', 'count')}

## 小红书违规/审核状态（手动截图）

${xhsStatusSection()}

## 当前可见结论

- 抖音当前作品：${latestDouyin?.parsed?.firstWorkTitle || '未读取到'}
- 抖音当前状态：${latestDouyin?.parsed?.status || '未读取到'}
- 小红书当前状态：${latestXhs?.parsed?.publishedFlag || latestXhs?.warnings?.join('；') || '未读取到'}
- 网站今日测试：${valueText(adminData.overview?.todayTests)}
- 网站 7 日测试：${valueText(adminData.overview?.weekTests)}
- 主要 UTM 来源：${adminData.utmSources?.[0] ? `${valueText(adminData.utmSources[0].source)} / ${valueText(adminData.utmSources[0].count)}` : '未读取到'}

## cheat-on-content 接入点

1. 发布前：对最终脚本执行 cheat-predict，写入不可变盲预测。
2. 发布后：执行 cheat-publish 记录平台、URL、发布时间。
3. T+24h/T+72h/T+7d：平台数据 + 网站后台数据进入 cheat-retro，对比预测并沉淀 rubric。

## 初步诊断框架

1. **平台播放低，网站测试也低**：封面/标题/开头没有带来足够点击，优先重做 A1 对标和 A2 钩子。
2. **平台播放高，网站测试低**：故事有停留但 CTA/主页路径弱，强化“主页免费测试”和评论引导。
3. **小红书收藏高，网站测试低**：内容被当资料收藏，标题和正文需要更明确地告诉用户去测试。
4. **抖音评论出现“想测/求链接/我是什么型”**：下一条强化评论区互动，并置顶测试入口说明。
5. **网站 UTM 中 douyin/xiaohongshu 增长**：保留当前风格，下一条只做单变量优化。

## 下一条视频建议占位

- 标题：待 T+24h / T+72h 数据补充后生成。
- 封面：优先测试“人格代码 + 强情绪钩子 + 人物画像”。
- 脚本：传统 16 型只做流量锚点；新增 65 型才重点讲 MBTI-PRO 差异。
- 画质：继续把平台预览清晰度作为验收，不只看本地文件。
- 音乐：用户当前在剪映添加 BGM，本地管线暂不强行内置。

## 待补评论

请在 T+24h 或 T+72h 抓取/粘贴两平台高赞评论，至少 5 条，最好 20 条。
`
}

function main() {
  const options = parseArgs()
  const logs = loadLogs(options.label)
  ensureDir(RETRO_DIR)
  const output = options.output || join(RETRO_DIR, `${options.label}_${new Date().toISOString().slice(0, 10)}.md`)
  writeFileSync(output, buildReport(logs), 'utf-8')
  console.log(`✅ 复盘草稿已生成：${output}`)
}

main()
