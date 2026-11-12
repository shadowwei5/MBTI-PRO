import crypto from 'crypto'
import { Router, type Request } from 'express'
import { prisma } from '../index.js'

export const accessRoutes = Router()

const MAX_ATTEMPTS = 30
const WINDOW_MS = 10 * 60 * 1000
const attempts = new Map<string, { count: number; resetAt: number }>()

function clientKey(req: Request): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) return forwarded.split(',')[0].trim()
  return req.ip || 'unknown'
}

function rateLimited(req: Request): boolean {
  const key = clientKey(req)
  const now = Date.now()
  const record = attempts.get(key)
  if (!record || record.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }
  record.count++
  return record.count > MAX_ATTEMPTS
}

export function normalizeAccessCode(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, '').toUpperCase() : ''
}

export async function isAccessGrantValid(token: unknown): Promise<boolean> {
  if (typeof token !== 'string' || !token) return false
  const grant = await prisma.accessGrant.findUnique({
    where: { token },
    include: { accessCode: true },
  }).catch(() => null)
  if (!grant) return false
  const code = grant.accessCode
  if (code.disabled) return false
  if (code.expiresAt && code.expiresAt.getTime() <= Date.now()) return false
  prisma.accessGrant.update({
    where: { token },
    data: { lastSeenAt: new Date() },
  }).catch(() => {})
  return true
}

// POST /api/access/redeem - 兑换小红书商品码，返回本机访问令牌
accessRoutes.post('/redeem', async (req, res, next) => {
  try {
    if (rateLimited(req)) {
      res.status(429).json({ success: false, error: '尝试次数过多，请稍后再试。' })
      return
    }

    const codeText = normalizeAccessCode(req.body?.code)
    if (!codeText) {
      res.status(400).json({ success: false, error: '请输入兑换码。' })
      return
    }

    const result = await prisma.$transaction(async (tx) => {
      const code = await tx.accessCode.findUnique({ where: { code: codeText } })
      if (!code || code.disabled) {
        throw new Error('INVALID_CODE')
      }
      if (code.expiresAt && code.expiresAt.getTime() <= Date.now()) {
        throw new Error('EXPIRED_CODE')
      }
      if (code.redemptions >= code.maxRedemptions) {
        throw new Error('USED_UP')
      }

      await tx.accessCode.update({
        where: { code: code.code },
        data: { redemptions: { increment: 1 } },
      })

      return tx.accessGrant.create({
        data: {
          token: crypto.randomBytes(32).toString('hex'),
          code: code.code,
        },
      })
    })

    res.json({
      success: true,
      data: {
        accessToken: result.token,
        expiresAt: null,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : ''
    if (message === 'INVALID_CODE') {
      res.status(404).json({ success: false, error: '兑换码无效，请检查后重试。' })
      return
    }
    if (message === 'EXPIRED_CODE') {
      res.status(410).json({ success: false, error: '兑换码已过期，请联系店铺客服。' })
      return
    }
    if (message === 'USED_UP') {
      res.status(409).json({ success: false, error: '兑换码使用次数已满，请联系店铺客服。' })
      return
    }
    next(err)
  }
})

// GET /api/access/check?token=... - 校验本机访问令牌
accessRoutes.get('/check', async (req, res, next) => {
  try {
    const valid = await isAccessGrantValid(req.query.token)
    res.json({ success: true, data: { valid } })
  } catch (err) {
    next(err)
  }
})
