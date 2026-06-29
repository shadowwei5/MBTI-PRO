import { Router } from 'express'
import { prisma } from '../index.js'

const router = Router()

// POST /api/email — 收集用户邮箱
router.post('/', async (req, res) => {
  try {
    const { email, typeCode, source } = req.body
    if (!email) {
      return res.status(400).json({ success: false, error: 'email required' })
    }
    // 简单邮箱格式校验
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, error: 'invalid email' })
    }
    // upsert: 同邮箱更新但不报错
    const record = await prisma.userEmail.upsert({
      where: { email },
      update: { typeCode: typeCode || null, source: source || 'paywall' },
      create: { email, typeCode: typeCode || null, source: source || 'paywall' },
    })
    res.json({ success: true, data: { id: record.id } })
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message })
  }
})

export default router
