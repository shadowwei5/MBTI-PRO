import { Router } from 'express'
import crypto from 'crypto'
import { prisma } from '../index.js'
import { getCreateReferralEligibilityError } from '../services/referralEligibility.js'

export const referralRoutes = Router()

function normalizeCode(code: string) {
  return code.trim().replace(/[^a-zA-Z0-9_-]/g, '')
}

function newReferralCode() {
  return crypto.randomBytes(6).toString('base64url')
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

async function sendRewardEmail(typeCode: string, email: string) {
  import('../services/email.js').then(({ sendPaymentEmail }) =>
    sendPaymentEmail(typeCode, email)
  ).catch(err => console.error('[referral] reward email error:', err))
}

export async function markReferralPaid(referralCode: string, referredRecordId: string): Promise<boolean> {
  const code = normalizeCode(referralCode)
  if (!code || !referredRecordId) return false
  const completion = await prisma.referralCompletion.update({
    where: { referredRecordId },
    data: { paid: true },
  }).catch(() => null)
  if (completion && completion.referralCode === code) {
    await prisma.referralReward.update({
      where: { code },
      data: { referredPaidCount: { increment: 1 } },
    }).catch(() => null)
    return true
  }
  return false
}

// POST /api/referrals/create — 为高置信度测试记录创建/更新邀请奖励
referralRoutes.post('/create', async (req, res, next) => {
  try {
    const { recordId, typeCode, email } = req.body as { recordId?: string; typeCode?: string; email?: string }
    if (!recordId) {
      res.status(400).json({ success: false, error: '未找到本次测试记录，请从完整测试结果页生成邀请链接。' })
      return
    }
    if (!email || !isValidEmail(email)) {
      res.status(400).json({ success: false, error: '请输入有效邮箱，用于接收免费解锁后的深度报告 PDF。' })
      return
    }

    const record = await prisma.testRecord.findUnique({
      where: { id: recordId },
      select: { id: true, typeCode: true, confidence: true },
    })
    const eligibilityError = getCreateReferralEligibilityError(record)
    if (eligibilityError) {
      res.status(400).json({ success: false, error: eligibilityError })
      return
    }
    const eligibleRecord = record!
    if (typeCode && eligibleRecord.typeCode !== typeCode.toUpperCase()) {
      console.warn('[referral] result type mismatch, using saved record type', { recordId, requestedTypeCode: typeCode, recordTypeCode: eligibleRecord.typeCode })
    }
    const existing = await prisma.referralReward.findFirst({ where: { referrerRecordId: recordId } })
    if (existing) {
      const updated = await prisma.referralReward.update({
        where: { code: existing.code },
        data: { referrerEmail: email },
      })
      res.json({ success: true, data: updated })
      return
    }

    let code = newReferralCode()
    while (await prisma.referralReward.findUnique({ where: { code } })) code = newReferralCode()

    const reward = await prisma.referralReward.create({
      data: {
        code,
        referrerRecordId: recordId,
        referrerTypeCode: eligibleRecord.typeCode,
        referrerEmail: email,
      },
    })
    res.json({ success: true, data: reward })
  } catch (err) {
    next(err)
  }
})

// POST /api/referrals/click — 记录被邀请链接访问
referralRoutes.post('/click', async (req, res, next) => {
  try {
    const code = normalizeCode(String(req.body?.code || ''))
    if (!code) {
      res.status(400).json({ success: false, error: 'code required' })
      return
    }
    const reward = await prisma.referralReward.update({
      where: { code },
      data: { clickedCount: { increment: 1 } },
      select: { code: true },
    }).catch(() => null)
    res.json({ success: true, data: { found: !!reward } })
  } catch (err) {
    next(err)
  }
})

// POST /api/referrals/complete — 乙高置信度完成测试后记有效邀请
referralRoutes.post('/complete', async (req, res, next) => {
  try {
    const referralCode = normalizeCode(String(req.body?.referralCode || ''))
    const referredRecordId = String(req.body?.referredRecordId || '')
    if (!referralCode || !referredRecordId) {
      res.status(400).json({ success: false, error: 'referralCode and referredRecordId required' })
      return
    }

    const [reward, record] = await Promise.all([
      prisma.referralReward.findUnique({ where: { code: referralCode } }),
      prisma.testRecord.findUnique({ where: { id: referredRecordId }, select: { id: true, typeCode: true, confidence: true } }),
    ])
    if (!reward || !record || record.id === reward.referrerRecordId || (record.confidence ?? 0) < 92) {
      res.json({ success: true, data: { counted: false, rewardUnlocked: reward?.rewardUnlocked ?? false } })
      return
    }

    const completion = await prisma.referralCompletion.create({
      data: {
        referralCode,
        referredRecordId,
        referredTypeCode: record.typeCode,
        confidence: record.confidence ?? 0,
      },
    }).catch(() => null)

    if (!completion) {
      res.json({ success: true, data: { counted: false, rewardUnlocked: reward.rewardUnlocked } })
      return
    }

    const nextValidCount = reward.validCompletedCount + 1
    const shouldUnlock = !reward.rewardUnlocked && nextValidCount >= 1 && !!reward.referrerEmail
    const updated = await prisma.referralReward.update({
      where: { code: referralCode },
      data: {
        validCompletedCount: { increment: 1 },
        rewardUnlocked: shouldUnlock ? true : reward.rewardUnlocked,
        rewardSentAt: shouldUnlock ? new Date() : reward.rewardSentAt,
      },
    })

    if (shouldUnlock && reward.referrerEmail) {
      await sendRewardEmail(reward.referrerTypeCode, reward.referrerEmail)
    }

    res.json({ success: true, data: { counted: true, rewardUnlocked: updated.rewardUnlocked } })
  } catch (err) {
    next(err)
  }
})

// POST /api/referrals/paid — 邀请带来的用户完成付费
referralRoutes.post('/paid', async (req, res, next) => {
  try {
    const referralCode = normalizeCode(String(req.body?.referralCode || ''))
    const referredRecordId = String(req.body?.referredRecordId || '')
    if (!referralCode || !referredRecordId) {
      res.status(400).json({ success: false, error: 'referralCode and referredRecordId required' })
      return
    }

    const counted = await markReferralPaid(referralCode, referredRecordId)
    res.json({ success: true, data: { counted } })
  } catch (err) {
    next(err)
  }
})
