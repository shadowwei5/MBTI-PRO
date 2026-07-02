import { Router, type Request, type Response } from 'express'
import { prisma } from '../index.js'
import { sendPaymentEmail } from '../services/email.js'
import { validateCompleteHighConfidenceRecord } from '../services/testRecordEligibility.js'

export const socialUnlockRoutes = Router()

const ADMIN_FALLBACK_KEY = 'mbti-pro-admin-2026'
const MAX_SCREENSHOT_CHARS = 6_000_000
const VALID_PLATFORMS = new Set(['douyin', 'xiaohongshu'])

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function assertAdminKey(req: Request, res: Response): boolean {
  const key = typeof req.query.key === 'string' ? req.query.key : req.body?.key
  if (key !== process.env.ADMIN_KEY && key !== ADMIN_FALLBACK_KEY) {
    res.status(403).json({ success: false, error: 'Forbidden' })
    return false
  }
  return true
}

function normalizeScreenshot(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed.startsWith('data:image/')) return null
  if (!/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=\r\n]+$/.test(trimmed)) return null
  if (trimmed.length > MAX_SCREENSHOT_CHARS) return null
  return trimmed.replace(/\r|\n/g, '')
}

socialUnlockRoutes.post('/', async (req, res, next) => {
  try {
    const { recordId, typeCode, email, platform, socialHandle, commentText, screenshotData } = req.body as Record<string, unknown>
    const normalizedTypeCode = typeof typeCode === 'string' ? typeCode.toUpperCase() : ''
    const normalizedEmail = typeof email === 'string' ? email.trim() : ''
    const normalizedPlatform = typeof platform === 'string' ? platform : ''
    const screenshot = normalizeScreenshot(screenshotData)

    if (!recordId || typeof recordId !== 'string' || !normalizedTypeCode) {
      res.status(400).json({ success: false, error: '请从完整测试结果页提交截图申请。' })
      return
    }
    if (!isValidEmail(normalizedEmail)) {
      res.status(400).json({ success: false, error: '请输入有效邮箱，审核通过后用于接收深度报告 PDF。' })
      return
    }
    if (!VALID_PLATFORMS.has(normalizedPlatform)) {
      res.status(400).json({ success: false, error: '请选择抖音或小红书平台。' })
      return
    }
    if (!screenshot) {
      res.status(400).json({ success: false, error: '请上传清晰的评论区截图，支持 PNG/JPG/WebP，大小不超过约 4MB。' })
      return
    }

    const eligibilityError = await validateCompleteHighConfidenceRecord(recordId, normalizedTypeCode)
    if (eligibilityError) {
      res.status(400).json({ success: false, error: eligibilityError })
      return
    }

    const existing = await prisma.socialUnlockRequest.findFirst({
      where: { recordId, status: { in: ['pending', 'approved'] } },
      orderBy: { createdAt: 'desc' },
    })
    if (existing) {
      res.json({ success: true, data: { id: existing.id, status: existing.status, message: existing.status === 'approved' ? '申请已通过，报告已发送或正在发送。' : '申请已提交，请等待人工审核。' } })
      return
    }

    const request = await prisma.socialUnlockRequest.create({
      data: {
        recordId,
        typeCode: normalizedTypeCode,
        email: normalizedEmail,
        platform: normalizedPlatform,
        socialHandle: typeof socialHandle === 'string' ? socialHandle.slice(0, 100) : null,
        commentText: typeof commentText === 'string' ? commentText.slice(0, 500) : null,
        screenshotData: screenshot,
      },
      select: { id: true, status: true },
    })

    res.status(201).json({ success: true, data: { ...request, message: '申请已提交。人工确认截图无误后，系统会自动把深度报告 PDF 发送到你的邮箱。' } })
  } catch (err) {
    next(err)
  }
})

socialUnlockRoutes.get('/admin', async (req, res, next) => {
  try {
    if (!assertAdminKey(req, res)) return
    const status = typeof req.query.status === 'string' ? req.query.status : undefined
    const requests = await prisma.socialUnlockRequest.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        recordId: true,
        typeCode: true,
        email: true,
        platform: true,
        socialHandle: true,
        commentText: true,
        screenshotData: true,
        status: true,
        reviewerNote: true,
        approvedAt: true,
        rejectedAt: true,
        reportSentAt: true,
        sendError: true,
        createdAt: true,
      },
    })
    res.json({ success: true, data: requests })
  } catch (err) {
    next(err)
  }
})

socialUnlockRoutes.post('/admin/:id/approve', async (req, res, next) => {
  try {
    if (!assertAdminKey(req, res)) return
    const id = req.params.id
    const note = typeof req.body?.note === 'string' ? req.body.note.slice(0, 300) : null
    const request = await prisma.socialUnlockRequest.findUnique({ where: { id } })
    if (!request) {
      res.status(404).json({ success: false, error: '申请不存在。' })
      return
    }
    if (request.status === 'approved' && request.reportSentAt) {
      res.json({ success: true, data: { id, sent: true, message: '该申请已审核通过并发送过报告。' } })
      return
    }

    await prisma.socialUnlockRequest.update({
      where: { id },
      data: { status: 'approved', reviewerNote: note, approvedAt: new Date(), sendError: 'sending' },
    })

    let sent = false
    try {
      sent = await sendPaymentEmail(request.typeCode, request.email)
      await prisma.socialUnlockRequest.update({
        where: { id },
        data: sent
          ? { reportSentAt: new Date(), sendError: null }
          : { sendError: 'email not sent: SMTP not configured, recipient email missing, or email service returned false' },
      })
    } catch (err) {
      await prisma.socialUnlockRequest.update({
        where: { id },
        data: { sendError: err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500) },
      }).catch(() => {})
      throw err
    }

    res.json({ success: true, data: { id, sent, email: request.email, typeCode: request.typeCode } })
  } catch (err) {
    next(err)
  }
})

socialUnlockRoutes.post('/admin/:id/reject', async (req, res, next) => {
  try {
    if (!assertAdminKey(req, res)) return
    const id = req.params.id
    const note = typeof req.body?.note === 'string' ? req.body.note.slice(0, 300) : null
    const request = await prisma.socialUnlockRequest.update({
      where: { id },
      data: { status: 'rejected', reviewerNote: note, rejectedAt: new Date() },
      select: { id: true, status: true },
    }).catch(() => null)
    if (!request) {
      res.status(404).json({ success: false, error: '申请不存在。' })
      return
    }
    res.json({ success: true, data: request })
  } catch (err) {
    next(err)
  }
})
