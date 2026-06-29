import { Router } from 'express'
import { prisma } from '../index.js'

export const recordRoutes = Router()

// POST /api/records - save a test record
recordRoutes.post('/', async (req, res, next) => {
  try {
    const { typeCode, scores, chars, answers, duration, dimAnswered, dimTotals, confidence, questionTimings, deviceInfo, utmSource, utmMedium, utmCampaign } = req.body
    if (!typeCode || !scores || !chars || !answers) {
      res.status(400).json({ success: false, error: 'Missing required fields' })
      return
    }
    const record = await prisma.testRecord.create({
      data: {
        typeCode,
        scores: JSON.stringify(scores),
        chars: JSON.stringify(chars),
        answers: JSON.stringify(answers),
        duration: duration || 0,
        dimAnswered: dimAnswered ? JSON.stringify(dimAnswered) : null,
        dimTotals: dimTotals ? JSON.stringify(dimTotals) : null,
        confidence: confidence ?? null,
        questionTimings: questionTimings ? JSON.stringify(questionTimings) : null,
        deviceInfo: deviceInfo || null,
        utmSource: utmSource || null,
        utmMedium: utmMedium || null,
        utmCampaign: utmCampaign || null,
      },
    })
    res.status(201).json({ success: true, data: { id: record.id } })
  } catch (err) {
    next(err)
  }
})

// GET /api/records/stats - basic statistics
recordRoutes.get('/stats', async (_req, res, next) => {
  try {
    const [total, todayCount] = await Promise.all([
      prisma.testRecord.count(),
      prisma.testRecord.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
    ])
    // Type distribution
    const distribution = await prisma.testRecord.groupBy({
      by: ['typeCode'],
      _count: { typeCode: true },
      orderBy: { _count: { typeCode: 'desc' } },
      take: 10,
    })
    res.json({
      success: true,
      data: {
        total,
        todayCount,
        topTypes: distribution.map(d => ({ code: d.typeCode, count: d._count.typeCode })),
      },
    })
  } catch (err) {
    next(err)
  }
})
