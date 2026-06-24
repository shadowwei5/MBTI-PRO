import { Router } from 'express'
import { prisma } from '../index.js'
import { calculateScore, type Answers, type QuestionMeta, type AnswerKey } from '../services/scoring.js'
import { getTypeDimensionModules } from '../content/dimension-modules.js'

export const resultRoutes = Router()

// POST /api/results/score - compute scores from answers (server-authoritative)
resultRoutes.post('/score', async (req, res, next) => {
  try {
    const body = req.body as {
      answers?: Record<string, string>
      questionIds?: number[]
      duration?: number
      timedOut?: Record<string, boolean>
    } | undefined
    if (!body || typeof body.answers !== 'object' || body.answers === null) {
      res.status(400).json({ success: false, error: 'answers (object) required' })
      return
    }

    const VALID_KEYS = new Set<AnswerKey>(['A', 'B', 'C', 'D', 'E'])
    const answers: Answers = {}
    for (const [k, v] of Object.entries(body.answers)) {
      const id = Number(k)
      if (!Number.isInteger(id) || id <= 0) continue
      if (typeof v !== 'string' || !VALID_KEYS.has(v as AnswerKey)) continue
      answers[id] = v as AnswerKey
    }

    // If client supplies questionIds, score only those (matches the actual quiz the user took).
    // Otherwise fall back to all questions in DB.
    const idFilter = Array.isArray(body.questionIds)
      ? body.questionIds.filter((n): n is number => Number.isInteger(n) && n > 0)
      : null

    const rows = await prisma.question.findMany({
      where: idFilter && idFilter.length > 0 ? { id: { in: idFilter } } : undefined,
      select: { id: true, dimension: true, type: true, correctAnswer: true },
    })
    const questions: QuestionMeta[] = rows.map(r => ({
      id: r.id,
      dimension: r.dimension as QuestionMeta['dimension'],
      type: r.type as QuestionMeta['type'],
      correctAnswer: r.correctAnswer ?? null,
    }))

    // Parse timedOut: convert string-number keys to number keys
    const timedOut: Record<number, boolean> = {}
    if (body.timedOut && typeof body.timedOut === 'object') {
      for (const [k, v] of Object.entries(body.timedOut)) {
        const id = Number(k)
        if (Number.isInteger(id) && id > 0) timedOut[id] = !!v
      }
    }

    const result = calculateScore(answers, questions, timedOut)

    res.json({
      success: true,
      data: {
        typeCode: result.typeCode,
        scores: result.scores,
        chars: result.chars,
        confidence: result.confidence,
      },
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/results - list all personality types (for homepage grid)
resultRoutes.get('/', async (_req, res, next) => {
  try {
    const types = await prisma.personalityType.findMany({
      select: {
        code: true,
        name: true,
        isTraditional: true,
        population: true,
        celebrities: true,
      },
      orderBy: { code: 'asc' },
    })
    res.json({
      success: true,
      data: types.map(t => ({
        ...t,
        celebrities: JSON.parse(t.celebrities || '[]'),
        imageUrl: `/api/thumbs/${t.code}`,
      })),
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/results/:typeCode/summary - compact result for listing
resultRoutes.get('/:typeCode/summary', async (req, res, next) => {
  try {
    const { typeCode } = req.params
    const type = await prisma.personalityType.findUnique({
      where: { code: typeCode.toUpperCase() },
      select: { code: true, name: true, isTraditional: true, overview: true },
    })
    if (!type) {
      res.status(404).json({ success: false, error: 'Type not found' })
      return
    }
    res.json({ success: true, data: type })
  } catch (err) {
    next(err)
  }
})

// GET /api/results/:typeCode - get personality type description
resultRoutes.get('/:typeCode', async (req, res, next) => {
  try {
    const { typeCode } = req.params
    const type = await prisma.personalityType.findUnique({
      where: { code: typeCode.toUpperCase() },
    })
    if (!type) {
      res.status(404).json({ success: false, error: 'Type not found' })
      return
    }
    // 使用81型独立维度模块（覆盖DB中的旧值，确保81型全部有独立文案）
    const dimModules = getTypeDimensionModules(type.code)

    // Parse JSON fields
    res.json({
      success: true,
      data: {
        ...type,
        eiModule: dimModules.eiModule,
        snModule: dimModules.snModule,
        tfModule: dimModules.tfModule,
        pjModule: dimModules.pjModule,
        strengths: JSON.parse(type.strengths),
        growthAreas: JSON.parse(type.growthAreas),
        careers: JSON.parse(type.careers),
        suitableFields: JSON.parse(type.suitableFields),
        celebrities: JSON.parse(type.celebrities || '[]'),
        imageUrl: `/api/images/${type.code}`,
      },
    })
  } catch (err) {
    next(err)
  }
})
