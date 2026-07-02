import { Router } from 'express'
import crypto from 'crypto'
import { prisma } from '../index.js'
import { sendPaymentEmail } from '../services/email.js'

export const shareUnlockRoutes = Router()

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function isShareUnlockValid(typeCode: string, unlockToken: string, recordId?: string): Promise<boolean> {
  if (!unlockToken || !recordId) return false
  const unlock = await prisma.shareUnlock.findUnique({ where: { unlockToken } }).catch(() => null)
  return !!unlock && unlock.typeCode === typeCode.toUpperCase() && unlock.recordId === recordId
}

async function sendShareUnlockReport(id: string, typeCode: string, email: string) {
  await prisma.shareUnlock.update({ where: { id }, data: { sendError: 'sending' } }).catch(() => {})
  try {
    const sent = await sendPaymentEmail(typeCode, email)
    await prisma.shareUnlock.update({
      where: { id },
      data: sent
        ? { reportSentAt: new Date(), sendError: null }
        : { sendError: 'email not sent: SMTP not configured, recipient email missing, or email service returned false' },
    })
    return sent
  } catch (err) {
    await prisma.shareUnlock.update({
      where: { id },
      data: { sendError: err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500) },
    }).catch(() => {})
    throw err
  }
}

shareUnlockRoutes.post('/create', async (req, res, next) => {
  try {
    const recordId = typeof req.body?.recordId === 'string' ? req.body.recordId : ''
    const typeCode = typeof req.body?.typeCode === 'string' ? req.body.typeCode.toUpperCase() : ''
    const email = typeof req.body?.email === 'string' ? req.body.email.trim() : ''
    const channel = typeof req.body?.channel === 'string' ? req.body.channel.trim().slice(0, 40) || null : null

    if (!recordId || !typeCode) {
      res.status(400).json({ success: false, error: '请从完整测试结果页生成分享海报。' })
      return
    }
    if (!isValidEmail(email)) {
      res.status(400).json({ success: false, error: '请输入有效邮箱，用于接收深度报告 PDF。' })
      return
    }

    const record = await prisma.testRecord.findUnique({
      where: { id: recordId },
      select: { typeCode: true },
    })
    if (!record || record.typeCode !== typeCode) {
      res.status(400).json({ success: false, error: '测试记录无效，请回到本次测试结果页重新生成分享海报。' })
      return
    }

    const existing = await prisma.shareUnlock.findFirst({ where: { recordId, email }, orderBy: { createdAt: 'desc' } })
    if (existing) {
      if (!existing.reportSentAt && existing.sendError !== 'sending') {
        sendShareUnlockReport(existing.id, existing.typeCode, existing.email).catch(err => console.error('[share-unlock] resend report error:', err))
      }
      res.json({ success: true, data: { unlockToken: existing.unlockToken, sent: !!existing.reportSentAt, id: existing.id } })
      return
    }

    const unlock = await prisma.shareUnlock.create({
      data: {
        recordId,
        typeCode,
        email,
        channel,
        unlockToken: crypto.randomBytes(24).toString('hex'),
      },
    })

    sendShareUnlockReport(unlock.id, unlock.typeCode, unlock.email).catch(err => console.error('[share-unlock] report email error:', err))
    res.status(201).json({ success: true, data: { unlockToken: unlock.unlockToken, sent: false, id: unlock.id } })
  } catch (err) {
    next(err)
  }
})
