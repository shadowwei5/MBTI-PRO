import { Router } from 'express'
import { prisma } from '../index.js'

export const resultRoutes = Router()

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
        imageUrl: `/api/images/${t.code}`,
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
    // Parse JSON fields
    res.json({
      success: true,
      data: {
        ...type,
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
