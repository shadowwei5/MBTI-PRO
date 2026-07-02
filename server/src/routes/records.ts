import { Router } from 'express'
import { prisma } from '../index.js'
import { calculateScore, type AnswerKey, type Answers, type QuestionMeta } from '../services/scoring.js'

export const recordRoutes = Router()

const VALID_KEYS = new Set<AnswerKey>(['A', 'B', 'C', 'D', 'E'])

function normalizeAnswers(raw: unknown): Answers {
  const answers: Answers = {}
  if (!raw || typeof raw !== 'object') return answers
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const id = Number(key)
    if (Number.isInteger(id) && id > 0 && typeof value === 'string' && VALID_KEYS.has(value as AnswerKey)) {
      answers[id] = value as AnswerKey
    }
  }
  return answers
}

function normalizeTimedOut(raw: unknown): Record<number, boolean> {
  const timedOut: Record<number, boolean> = {}
  if (!raw || typeof raw !== 'object') return timedOut
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const id = Number(key)
    if (Number.isInteger(id) && id > 0) timedOut[id] = !!value
  }
  return timedOut
}

function cleanQuestionTimings(raw: unknown): Record<number, number> | null {
  if (!raw || typeof raw !== 'object') return null
  const cleaned: Record<number, number> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const id = Number(key)
    if (!Number.isInteger(id) || id <= 0 || typeof value !== 'number' || !Number.isFinite(value)) continue
    cleaned[id] = Math.max(0.1, Math.min(120, Math.round(value * 10) / 10))
  }
  return Object.keys(cleaned).length ? cleaned : null
}

async function getQuestionMeta(): Promise<QuestionMeta[]> {
  const rows = await prisma.question.findMany({
    select: { id: true, dimension: true, type: true, correctAnswer: true },
  })
  return rows.map(row => ({
    id: row.id,
    dimension: row.dimension as QuestionMeta['dimension'],
    type: row.type as QuestionMeta['type'],
    correctAnswer: row.correctAnswer ?? null,
  }))
}

recordRoutes.post('/', async (req, res, next) => {
  try {
    const { answers: rawAnswers, duration, questionTimings, deviceInfo, utmSource, utmMedium, utmCampaign, timedOut: rawTimedOut } = req.body
    const answers = normalizeAnswers(rawAnswers)
    const questions = await getQuestionMeta()
    const requiredIds = new Set(questions.map(q => q.id))
    const answeredRequiredCount = [...requiredIds].filter(id => answers[id]).length

    if (!questions.length) {
      res.status(500).json({ success: false, error: 'questions not loaded' })
      return
    }

    const incomplete = answeredRequiredCount < requiredIds.size
    const calculated = calculateScore(answers, questions, normalizeTimedOut(rawTimedOut))
    const result = incomplete
      ? {
          ...calculated,
          typeCode: 'INTJ',
          chars: { E_I: 'I', S_N: 'N', T_F: 'T', P_J: 'J' } as typeof calculated.chars,
          scores: { ...calculated.scores, E_I: 0, S_N: 0, T_F: 0, P_J: 0, T_F_sub: 0, T_F_obj: 0 },
          confidence: 0,
        }
      : calculated
    const cleanedTimings = cleanQuestionTimings(questionTimings)
    const safeDuration = typeof duration === 'number' && Number.isFinite(duration) ? Math.max(0, Math.round(duration)) : 0

    const record = await prisma.testRecord.create({
      data: {
        typeCode: result.typeCode,
        scores: JSON.stringify(result.scores),
        chars: JSON.stringify(result.chars),
        answers: JSON.stringify(answers),
        duration: safeDuration,
        dimAnswered: JSON.stringify(result.dimAnswered),
        dimTotals: JSON.stringify(result.dimTotals),
        confidence: incomplete ? 0 : Math.round(result.confidence * 100),
        questionTimings: cleanedTimings ? JSON.stringify(cleanedTimings) : null,
        deviceInfo: deviceInfo || null,
        utmSource: utmSource || null,
        utmMedium: utmMedium || null,
        utmCampaign: utmCampaign || null,
      },
    })
    res.status(201).json({ success: true, data: { id: record.id, typeCode: record.typeCode, confidence: record.confidence } })
  } catch (err) {
    next(err)
  }
})

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
