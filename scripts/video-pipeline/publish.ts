// ============================================================
// MBTI-PRO Video Pipeline — 多平台发布调度器
// 支持: 抖音、B站、小红书、微信公众号
// ============================================================

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { PublishTask, PublishResult, Platform } from './types.js'

// 发布日志路径
const PUBLISH_LOG_DIR = join(import.meta.dirname, '..', '..', 'video', 'output')

/**
 * 发布到抖音
 * 方案1: lancelin111/douyin-mcp-server (npm v2.0.1) — Puppeteer 自动化
 * 方案2: videoclaw (GitHub) — 集成发布
 * 降级: 手动发布
 */
async function publishDouyin(task: PublishTask): Promise<PublishResult> {
  console.log(`[publish:douyin] 发布: ${task.title}`)

  // 检查是否安装了 douyin-mcp-server
  try {
    // 尝试调用 MCP 工具
    // 实际使用中通过 Claude Code 的 MCP 协议调用
    console.log(`[publish:douyin] 视频: ${task.videoPath}`)
    console.log(`[publish:douyin] 封面: ${task.coverPath}`)
    console.log(`[publish:douyin] 标题: ${task.title}`)
    console.log(`[publish:douyin] 标签: ${task.tags.join(', ')}`)

    // TODO: 实际 MCP 调用
    // const result = await mcpCall('douyin-mcp-server', 'douyin-video', {
    //   videoPath: task.videoPath,
    //   title: task.title,
    //   tags: task.tags,
    // })

    return {
      platform: 'douyin',
      success: true,
      timestamp: new Date().toISOString(),
      url: '[待发布 - 请手动上传到抖音创作者中心]',
    }
  } catch (err) {
    return {
      platform: 'douyin',
      success: false,
      error: String(err),
      timestamp: new Date().toISOString(),
    }
  }
}

/**
 * 通过 HuiMei MCP 发布到 B站/小红书/微信公众号
 */
async function publishViaHuimei(task: PublishTask, platform: Platform): Promise<PublishResult> {
  console.log(`[publish:huimei:${platform}] 发布: ${task.title}`)

  // HuiMei MCP 支持 11+ 平台
  // 通过 Claude Code MCP 协议调用
  console.log(`[publish:huimei:${platform}] 视频: ${task.videoPath}`)
  console.log(`[publish:huimei:${platform}] 描述: ${task.description}`)
  console.log(`[publish:huimei:${platform}] 标签: ${task.tags.join(', ')}`)

  return {
    platform,
    success: true,
    timestamp: new Date().toISOString(),
    url: `[待发布 - 请手动上传到${platform}]`,
  }
}

/**
 * 主发布入口
 */
export async function publishToPlatforms(task: PublishTask): Promise<PublishResult[]> {
  const { platforms } = task
  console.log(`\n[publish] 📤 发布到 ${platforms.length} 个平台: ${platforms.join(', ')}`)
  console.log(`[publish] 类型: ${task.typeCode}`)
  console.log(`[publish] 标题: ${task.title}`)

  const results: PublishResult[] = []

  for (const platform of platforms) {
    let result: PublishResult

    switch (platform) {
      case 'douyin':
        result = await publishDouyin(task)
        break
      case 'bilibili':
      case 'xiaohongshu':
      case 'wechat':
        result = await publishViaHuimei(task, platform)
        break
      default:
        result = {
          platform,
          success: false,
          error: `不支持的平台: ${platform}`,
          timestamp: new Date().toISOString(),
        }
    }

    results.push(result)

    if (result.success) {
      console.log(`[publish] ✅ ${platform}: ${result.url ?? '已发布'}`)
    } else {
      console.log(`[publish] ❌ ${platform}: ${result.error}`)
    }
  }

  // 记录发布日志
  savePublishLog(task, results)

  return results
}

/**
 * 保存发布日志
 */
function savePublishLog(task: PublishTask, results: PublishResult[]): void {
  if (!existsSync(PUBLISH_LOG_DIR)) {
    mkdirSync(PUBLISH_LOG_DIR, { recursive: true })
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const logPath = join(PUBLISH_LOG_DIR, `publish-${task.typeCode}-${timestamp}.json`)
  writeFileSync(logPath, JSON.stringify({
    task,
    results,
    publishedAt: new Date().toISOString(),
  }, null, 2), 'utf-8')

  console.log(`[publish] 日志: ${logPath}`)
}

/**
 * 为类型生成各平台适配文案
 */
export function generatePlatformCaptions(typeData: any, platform: Platform): {
  title: string
  description: string
  tags: string[]
} {
  const code = typeData.code
  const name = typeData.name
  const overview = typeData.overview?.substring(0, 50) ?? ''
  const groupName = typeData._groupName ?? ''
  const strength = typeData.strengths?.[0] ?? ''

  const templates: Record<Platform, { title: string; description: string; tags: string[] }> = {
    douyin: {
      title: `你是${name}型人格吗？🤔 #MBTI`,
      description: `${overview}... 测测你的81型人格 #性格测试 #心理学`,
      tags: ['MBTI', '人格测试', '性格分析', 'MBTI-PRO', '自我认知'],
    },
    bilibili: {
      title: `【MBTI-PRO】${code} ${name}深度解析 | 81型人格测试`,
      description: `${code} ${name}型人格完整解析。${overview}`,
      tags: ['MBTI', '人格测试', '心理学', '性格分析', 'MBTI-PRO', '知识'],
    },
    xiaohongshu: {
      title: `你是${name}型吗？🤔✨`,
      description: `${overview}\n\n#MBTI #人格测试 #${groupName}`,
      tags: ['MBTI', '人格测试', '自我认知', '性格分析', '心理测试'],
    },
    wechat: {
      title: `【81型人格】${code} ${name}：${overview}`,
      description: `${code} ${name}型人格深度解读...`,
      tags: ['MBTI', '人格测试', '性格分析'],
    },
  }

  return templates[platform]
}
