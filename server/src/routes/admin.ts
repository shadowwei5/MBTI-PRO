import { Router } from 'express'
import { prisma } from '../index.js'
import { ADMIN_DIMENSION_LABELS, ADMIN_QUESTION_TYPE_LABELS, isValidQuestionTiming } from '../services/adminStats.js'
import { sendPaidReportEmail } from './payment.js'
import { sendPaymentEmail } from '../services/email.js'
import { getSmtpPort, getSmtpSecure, hasSmtpConfig } from '../services/smtpConfig.js'
import { loadServerEnv } from '../config/env.js'

export const adminRoutes = Router()

loadServerEnv()

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
      referralCount, referralClicks, referralValidCompletions, referralRewards, referralPaid,
      shareUnlockCount, shareUnlockSent, shareUnlockToday, shareUnlockChannels,
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
      prisma.referralReward.count(),
      prisma.referralReward.aggregate({ _sum: { clickedCount: true } }),
      prisma.referralReward.aggregate({ _sum: { validCompletedCount: true } }),
      prisma.referralReward.count({ where: { rewardUnlocked: true } }),
      prisma.referralReward.aggregate({ _sum: { referredPaidCount: true } }),
      prisma.shareUnlock.count(),
      prisma.shareUnlock.count({ where: { reportSentAt: { not: null } } }),
      prisma.shareUnlock.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.shareUnlock.groupBy({ by: ['channel'], _count: true, orderBy: { _count: { channel: 'desc' } }, take: 10 }),
    ])

    const completedIds = completedRecords.map(r => r.id)
    const timingRecords = await prisma.testRecord.findMany({
      where: { questionTimings: { not: null } },
      select: { questionTimings: true },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    })
    const questions = await prisma.question.findMany({
      select: { id: true, dimension: true, type: true, sortOrder: true, text: true, textLeft: true, textRight: true },
    })
    const questionMeta = new Map(questions.map(q => [q.id, q]))

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

    const timingMap = new Map<number, number[]>()
    for (const record of timingRecords) {
      if (!record.questionTimings) continue
      try {
        const parsed = JSON.parse(record.questionTimings) as Record<string, number>
        for (const [idText, seconds] of Object.entries(parsed)) {
          const id = Number(idText)
          if (!Number.isInteger(id) || !isValidQuestionTiming(seconds)) continue
          const list = timingMap.get(id) || []
          list.push(seconds)
          timingMap.set(id, list)
        }
      } catch { /* ignore malformed timing json */ }
    }
    const questionTimingStats = [...timingMap.entries()].map(([questionId, values]) => {
      const sorted = [...values].sort((a, b) => a - b)
      const meta = questionMeta.get(questionId)
      const label = meta?.type === 'likert'
        ? `${meta.textLeft || ''} / ${meta.textRight || ''}`.trim()
        : meta?.text || ''
      return {
        questionId,
        dimension: meta?.dimension || '-',
        dimensionLabel: ADMIN_DIMENSION_LABELS[meta?.dimension || ''] || meta?.dimension || '-',
        type: meta?.type || '-',
        typeLabel: ADMIN_QUESTION_TYPE_LABELS[meta?.type || ''] || meta?.type || '-',
        sortOrder: meta?.sortOrder ?? questionId,
        label: label.length > 42 ? `${label.slice(0, 42)}...` : label,
        samples: values.length,
        avgSec: Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10,
        medianSec: sorted[Math.floor(sorted.length / 2)],
      }
    }).sort((a, b) => b.avgSec - a.avgSec).slice(0, 15)

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
        questionTimingStats,
        referralFunnel: {
          shares: referralCount,
          clicks: referralClicks._sum.clickedCount ?? 0,
          validCompletions: referralValidCompletions._sum.validCompletedCount ?? 0,
          rewardUnlocks: referralRewards,
          referredPaid: referralPaid._sum.referredPaidCount ?? 0,
        },
        shareUnlockFunnel: {
          unlocks: shareUnlockCount,
          sentReports: shareUnlockSent,
          todayUnlocks: shareUnlockToday,
          channels: shareUnlockChannels.map(item => ({ channel: item.channel || 'unknown', count: item._count })),
        },
        dailyTrend,
        utmSources: utmSources.map(u => ({ source: u.utmSource || 'direct', count: u._count })),
      },
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/admin/resend-report — 强制发送指定人格报告到指定邮箱
adminRoutes.post('/resend-report', async (req, res, next) => {
  try {
    const key = req.query.key as string || req.body?.key
    if (key !== process.env.ADMIN_KEY && key !== 'mbti-pro-admin-2026') {
      res.status(403).json({ success: false, error: 'Forbidden' })
      return
    }

    const email = typeof req.query.email === 'string' ? req.query.email : req.body?.email
    const typeCode = (typeof req.query.typeCode === 'string' ? req.query.typeCode : req.body?.typeCode || 'ISFP').toUpperCase()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ success: false, error: 'valid email required' })
      return
    }

    const sent = await sendPaymentEmail(typeCode, email)
    res.json({ success: true, data: { typeCode, email, sent } })
  } catch (err) {
    next(err)
  }
})

// POST /api/admin/resend-paid-emails — 补发已支付但未成功发送的深度报告邮件
adminRoutes.post('/resend-paid-emails', async (req, res, next) => {
  try {
    const key = req.query.key as string || req.body?.key
    if (key !== process.env.ADMIN_KEY && key !== 'mbti-pro-admin-2026') {
      res.status(403).json({ success: false, error: 'Forbidden' })
      return
    }

    const orders = await prisma.paymentOrder.findMany({
      where: { paid: true, emailSentAt: null, email: { not: null } },
      orderBy: { paidAt: 'desc' },
      take: 20,
      select: { orderId: true, typeCode: true, email: true, emailSentAt: true, emailSendError: true },
    })

    let sent = 0
    const results = []
    for (const order of orders) {
      const ok = await sendPaidReportEmail(order)
      if (ok) sent++
      const updated = await prisma.paymentOrder.findUnique({
        where: { orderId: order.orderId },
        select: { emailSentAt: true, emailSendError: true },
      })
      results.push({
        orderId: order.orderId,
        typeCode: order.typeCode,
        email: order.email,
        sent: ok,
        error: updated?.emailSendError || null,
      })
    }

    res.json({
      success: true,
      data: {
        checked: orders.length,
        sent,
        smtp: {
          configured: hasSmtpConfig(),
          hostConfigured: Boolean(process.env.SMTP_HOST),
          userConfigured: Boolean(process.env.SMTP_USER),
          passConfigured: Boolean(process.env.SMTP_PASS),
          port: getSmtpPort(),
          secure: getSmtpSecure(),
        },
        results,
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
