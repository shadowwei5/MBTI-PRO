// ============================================================
// MBTI-PRO · 每日自动化闭环
// 09:00 回收昨日数据 → 评分 → 选题 → 审 prompt → 生成 → 发布
// ============================================================
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import type { PublishTask } from './types.js'

const ROOT = resolve(import.meta.dirname, '..', '..')
const LOOP_DIR = join(ROOT, 'video', 'output', '_daily_loop')
mkdirSync(LOOP_DIR, { recursive: true })

interface DayStats {
  date: string
  type: string
  douyin: { views: number; likes: number; comments: number; shares: number }
  xiaohongshu: { views: number; likes: number; comments: number; shares: number }
  wechat: { views: number; likes: number; comments: number; shares: number }
  totalScore: number
}

/**
 * Step 1: 回收昨日发布数据（模拟 / 实际从平台后台爬）
 */
async function collectYesterdayStats(typeCode: string): Promise<DayStats> {
  console.log('[loop] 📊 回收昨日数据...')
  const statsPath = join(LOOP_DIR, `${typeCode}_stats.json')
  if (existsSync(statsPath)) {
    const cached = JSON.parse(readFileSync(statsPath, 'utf-8'))
    console.log(`[loop] 读取缓存数据: ${cached.totalScore} 分`)
    return cached
  }

  // 模拟数据（实际：用 Playwright 从创作者后台抓取）
  const stats: DayStats = {
    date: new Date().toISOString().slice(0, 10),
    type: typeCode,
    douyin: { views: 12800, likes: 420, comments: 86, shares: 124 },
    xiaohongshu: { views: 5600, likes: 310, comments: 42, shares: 78 },
    wechat: { views: 3200, likes: 156, comments: 24, shares: 56 },
    totalScore: 0,
  }
  stats.totalScore =
    (stats.douyin.views + stats.xiaohongshu.views + stats.wechat.views) / 100 +
    (stats.douyin.likes + stats.xiaohongshu.likes + stats.wechat.likes) * 0.5 +
    (stats.douyin.comments + stats.xiaohongshu.comments + stats.wechat.comments) * 2

  writeFileSync(statsPath, JSON.stringify(stats, null, 2), 'utf-8')
  console.log(`[loop] ✅ 数据回收完成，综合评分: ${stats.totalScore.toFixed(1)}`)
  return stats
}

/**
 * Step 2: 评分 + 选题建议
 * 根据历史数据选下一个最优人格类型
 */
function decideNextType(history: DayStats[]): string {
  console.log('[loop] 🎯 选题决策...')
  // 简单策略：已发布的类型里超过 5000 分 → 同系列继续；否则轮换
  const highPerformers = history.filter(s => s.totalScore > 5000).map(s => s.type)
  const allTypes = ['ENTP', 'ENFP', 'ENTJ', 'INTJ', 'INTP', 'INFP', 'ENFJ', 'INFJ', 'ESTP', 'ESTJ', 'ESFP', 'ESFJ', 'ISTP', 'ISTJ', 'ISFP', 'ISFJ']
  const next = allTypes.find(t => !history.find(h => h.type === t)) || 'ENTP'
  console.log(`[loop] 已发布: ${history.map(h => h.type).join(', ')}`)
  console.log(`[loop] 高分种子: ${highPerformers.join(', ') || '无'}`)
  console.log(`[loop] 下一个选题: ${next}`)
  return next
}

/**
 * Step 3: 生成配音 + 合成视频
 */
async function generateFinalVideo(typeCode: string): Promise<{ videoPath: string; coverPath: string }> {
  console.log(`[loop] 🎙️ 生成 ${typeCode} 火山复刻配音...`)
  spawnSync('npx', ['tsx', 'render-volc-liuyuxi.ts', '--code', typeCode], {
    cwd: join(ROOT, 'scripts', 'video-pipeline'),
    stdio: 'inherit',
    shell: true,
  })

  console.log(`[loop] 🎬 合成 ${typeCode} 最终视频（配音+BGM+字幕）...`)
  spawnSync('npx', ['tsx', 'render-mbti-final.ts', '--code', typeCode], {
    cwd: join(ROOT, 'scripts', 'video-pipeline'),
    stdio: 'inherit',
    shell: true,
  })

  console.log(`[loop] 🖼️ 生成 ${typeCode} 横版封面...`)
  spawnSync('npx', ['tsx', 'gen-cover-landscape.ts', '--code', typeCode], {
    cwd: join(ROOT, 'scripts', 'video-pipeline'),
    stdio: 'inherit',
    shell: true,
  })

  const videoPath = join(ROOT, 'video', 'output', `${typeCode}_daily_final_volc_liuyuxi_bgm.mp4`)
  const coverPath = join(ROOT, 'video', 'output', `cover_${typeCode}_daily_landscape.png`)

  return { videoPath, coverPath }
}

/**
 * Step 4: 三平台发布
 */
async function publish(typeCode: string, assets: { videoPath: string; coverPath: string }) {
  console.log(`[loop] 🚀 发布 ${typeCode} 到三平台...`)
  const { publishToPlatforms } = await import('./publish-auto.js')
  const task: PublishTask = {
    typeCode,
    title: `${typeCode} 最上头的，是能接住他脑洞的人`,
    description: '他不是爱抬杠，他是真的停不下来。主页免费测 81 型人格，看看你到底是哪一种。',
    tags: ['MBTI', typeCode, '81型人格', '人格测试', '心理学'],
    videoPath: assets.videoPath,
    coverPath: assets.coverPath,
    platforms: ['douyin', 'xiaohongshu', 'wechat'],
  }
  return await publishToPlatforms(task)
}

/**
 * 完整每日闭环
 */
async function runDailyLoop(seedType: string = 'ENTP') {
  console.log('\n' + '='.repeat(60))
  console.log('MBTI-PRO · 每日自动化闭环启动')
  console.log('='.repeat(60) + '\n')

  // Step 1: 数据回收
  const history = [await collectYesterdayStats(seedType)]

  // Step 2: 选题
  const nextType = decideNextType(history)

  // Step 3: 生成
  const assets = await generateFinalVideo(nextType)

  // Step 4: 发布
  const results = await publish(nextType, assets)

  console.log('\n' + '='.repeat(60))
  console.log('✅ 每日闭环完成')
  console.log(`📊 昨日评分: ${history[0].totalScore.toFixed(1)} 分`)
  console.log(`🎯 今日选题: ${nextType}`)
  console.log(`🎬 视频: ${assets.videoPath}`)
  console.log(`🖼️ 封面: ${assets.coverPath}`)
  console.log('='.repeat(60) + '\n')

  return { history, nextType, assets, results }
}

// CLI 运行入口
if (import.meta.url.endsWith(process.argv[1])) {
  const seed = process.argv.find(a => a.startsWith('--seed='))?.slice(7) || 'ENTP'
  await runDailyLoop(seed)
  process.exit(0)
}

export { runDailyLoop, collectYesterdayStats, decideNextType }
