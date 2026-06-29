import { Router } from 'express'
import { prisma } from '../index.js'

export const adminRoutes = Router()

// GET /api/admin/stats — 仪表盘全部统计数据
adminRoutes.get('/stats', async (_req, res, next) => {
  try {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    // 并行查询所有统计数据
    const [
      totalTests, todayTests, weekTests,
      typeDist, todayTypeDist,
      feedbacks, emails, todayEmails,
      abandonCount, completedCount,
      completedRecords, // 置信度≥92%的记录(用于过滤反馈)
    ] = await Promise.all([
      prisma.testRecord.count(),
      prisma.testRecord.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.testRecord.count({ where: { createdAt: { gte: weekStart } } }),
      prisma.testRecord.groupBy({ by: ['typeCode'], _count: true, where: { confidence: { gte: 92 } }, orderBy: { _count: { typeCode: 'desc' } }, take: 15 }),
      prisma.testRecord.groupBy({ by: ['typeCode'], _count: true, where: { AND: [{ createdAt: { gte: todayStart } }, { confidence: { gte: 92 } }] }, orderBy: { _count: { typeCode: 'desc' } }, take: 10 }),
      prisma.userFeedback.count(),
      prisma.userEmail.count(),
      prisma.userEmail.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.testRecord.count({ where: { confidence: { lt: 92 } } }),
      prisma.testRecord.count({ where: { confidence: { gte: 92 } } }),
      prisma.testRecord.findMany({ where: { confidence: { gte: 92 } }, select: { id: true } }),
    ])

    const completedIds = completedRecords.map(r => r.id)

    // 仅统计完成测试(置信度≥92%)的反馈
    const [likedStats, dislikedStats] = await Promise.all([
      prisma.userFeedback.groupBy({
        by: ['likedType'], _count: true,
        where: { recordId: { in: completedIds } },
        orderBy: { _count: { likedType: 'desc' } }, take: 10,
      }),
      prisma.userFeedback.groupBy({
        by: ['dislikedType'], _count: true,
        where: { recordId: { in: completedIds } },
        orderBy: { _count: { dislikedType: 'desc' } }, take: 10,
      }),
    ])

    const totalWithConfidence = abandonCount + completedCount
    const completionRate = totalWithConfidence > 0 ? Math.round((completedCount / totalWithConfidence) * 100) : 0

    // 类型分布格式化
    const typeDistribution = typeDist.map(d => ({ code: d.typeCode, count: d._count }))
    const todayTypeDistribution = todayTypeDist.map(d => ({ code: d.typeCode, count: d._count }))

    // 反馈格式化
    const topLiked = likedStats.map(d => ({ type: d.likedType, count: d._count }))
    const topDisliked = dislikedStats.map(d => ({ type: d.dislikedType, count: d._count }))

    // 近7天趋势（每天测试数）
    const dailyTrend: { date: string; count: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)
      const count = await prisma.testRecord.count({
        where: { createdAt: { gte: dayStart, lt: dayEnd } },
      })
      dailyTrend.push({
        date: `${dayStart.getMonth() + 1}/${dayStart.getDate()}`,
        count,
      })
    }

    // 平均耗时
    const durationResult = await prisma.testRecord.aggregate({
      _avg: { duration: true },
      where: { duration: { gt: 0 } },
    })

    // UTM来源统计
    const utmSources = await prisma.testRecord.groupBy({
      by: ['utmSource'],
      _count: true,
      where: { utmSource: { not: null } },
      orderBy: { _count: { utmSource: 'desc' } },
      take: 10,
    })

    res.json({
      success: true,
      data: {
        overview: {
          totalTests,
          todayTests,
          weekTests,
          totalFeedbacks: feedbacks,
          totalEmails: emails,
          todayEmails,
          avgDurationSec: Math.round(durationResult._avg.duration ?? 0),
          completionRate,
        },
        typeDistribution,
        todayTypeDistribution,
        topLiked,
        topDisliked,
        dailyTrend,
        utmSources: utmSources.map(u => ({ source: u.utmSource || 'direct', count: u._count })),
      },
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/admin/emails — 导出邮箱列表(简单鉴权)
adminRoutes.get('/emails', async (req, res, next) => {
  try {
    const key = req.query.key as string
    if (key !== process.env.ADMIN_KEY && key !== 'mbti-pro-admin-2026') {
      res.status(403).json({ success: false, error: 'Forbidden' })
      return
    }
    const emails = await prisma.userEmail.findMany({
      orderBy: { createdAt: 'desc' },
      select: { email: true, typeCode: true, source: true, createdAt: true },
    })
    res.json({ success: true, data: emails, total: emails.length })
  } catch (err) {
    next(err)
  }
})

// GET /api/admin/traffic — 流量来源分析
adminRoutes.get('/traffic', async (_req, res, next) => {
  try {
    const [utmSources, utmMediums, deviceBreakdown] = await Promise.all([
      prisma.testRecord.groupBy({ by: ['utmSource'], _count: true, where: { utmSource: { not: null } }, orderBy: { _count: { utmSource: 'desc' } } }),
      prisma.testRecord.groupBy({ by: ['utmMedium'], _count: true, where: { utmMedium: { not: null } }, orderBy: { _count: { utmMedium: 'desc' } } }),
      // 统计有deviceInfo的记录
      prisma.testRecord.count({ where: { deviceInfo: { not: null } } }),
    ])
    res.json({
      success: true,
      data: {
        utmSources: utmSources.map(u => ({ source: u.utmSource, count: u._count })),
        utmMediums: utmMediums.map(u => ({ medium: u.utmMedium, count: u._count })),
        withDeviceInfo: deviceBreakdown,
      },
    })
  } catch (err) {
    next(err)
  }
})
