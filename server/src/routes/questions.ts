import { Router } from 'express'
import { prisma } from '../index.js'

export const questionRoutes = Router()

// GET /api/questions - list all questions (for test-taking)
questionRoutes.get('/', async (_req, res, next) => {
  try {
    const questions = await prisma.question.findMany({
      orderBy: { sortOrder: 'asc' },
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
    // Parse options JSON strings
    const parsed = questions.map(q => ({
      ...q,
      options: JSON.parse(q.options),
    }))
    res.json({ success: true, data: parsed })
  } catch (err) {
    next(err)
  }
})

// GET /api/questions/count - total question count
questionRoutes.get('/count', async (_req, res, next) => {
  try {
    const count = await prisma.question.count()
    res.json({ success: true, data: { count } })
  } catch (err) {
    next(err)
  }
})
