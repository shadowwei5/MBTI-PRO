import { Router } from 'express'
import { prisma } from '../index.js'

const router = Router()

// POST /api/feedback — 用户提交相处偏好
router.post('/', async (req, res) => {
  try {
    const { userType, likedType, dislikedType } = req.body
    if (!userType || !likedType || !dislikedType) {
      return res.status(400).json({ success: false, error: '缺少必填字段: userType, likedType, dislikedType' })
    }
    const fb = await prisma.userFeedback.create({
      data: { userType, likedType, dislikedType },
    })
    res.json({ success: true, data: { id: fb.id } })
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message })
  }
})

// GET /api/feedback/stats — 获取兼容性统计数据
router.get('/stats', async (req, res) => {
  try {
    const type = req.query.type as string
    const all = await prisma.userFeedback.findMany({
      ...(type ? { where: { userType: type } } : {}),
      orderBy: { createdAt: 'desc' },
      take: 5000,
    })

    // 聚合统计
    const liked: Record<string, number> = {}
    const disliked: Record<string, number> = {}
    for (const fb of all) {
      liked[fb.likedType] = (liked[fb.likedType] || 0) + 1
      disliked[fb.dislikedType] = (disliked[fb.dislikedType] || 0) + 1
    }

    const sortEntries = (obj: Record<string, number>) =>
      Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, 10)

    res.json({
      success: true,
      data: {
        total: all.length,
        topLiked: sortEntries(liked),
        topDisliked: sortEntries(disliked),
      },
    })
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message })
  }
})

export default router
