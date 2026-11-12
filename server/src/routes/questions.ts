import { Router } from 'express'
import { prisma } from '../index.js'
import { SHORT_FORM_QUESTION_IDS, SHORT_FORM_TOTAL } from '../content/short-form.js'

export const questionRoutes = Router()

// GET /api/questions - 40 题首发版（按固定展示顺序返回）
questionRoutes.get('/', async (_req, res, next) => {
  try {
    const questions = await prisma.question.findMany({
      where: { id: { in: [...SHORT_FORM_QUESTION_IDS] } },
      select: {
        id: true,
        text: true,
        textLeft: true,
        textRight: true,
        dimension: true,
        type: true,
        options: true,
        correctAnswer: true,
      },
    })
    const byId = new Map(questions.map(q => [q.id, q]))
    const ordered = SHORT_FORM_QUESTION_IDS
      .map(id => byId.get(id))
      .filter((q): q is NonNullable<typeof q> => Boolean(q))
      .map(q => ({
        ...q,
        options: JSON.parse(q.options),
      }))
    res.json({ success: true, data: ordered })
  } catch (err) {
    next(err)
  }
})

// GET /api/questions/count - 首发版题目数
questionRoutes.get('/count', async (_req, res, next) => {
  try {
    res.json({ success: true, data: { count: SHORT_FORM_TOTAL } })
  } catch (err) {
    next(err)
  }
})
