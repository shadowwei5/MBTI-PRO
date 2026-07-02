import { Router } from 'express'
import crypto from 'crypto'
import { prisma } from '../index.js'
import { markReferralPaid } from './referrals.js'
import { loadServerEnv } from '../config/env.js'
import { validateCompleteHighConfidenceRecord } from '../services/testRecordEligibility.js'

export const paymentRoutes = Router()

loadServerEnv()

const XORPAY_BASE = 'https://xorpay.com/api'
const AID = process.env.XORPAY_AID || ''
const SECRET = process.env.XORPAY_SECRET || ''
const NOTIFY_URL = process.env.XORPAY_NOTIFY_URL || ''
const paidOrdersCache = new Map<string, string>()

function md5(s: string): string {
  return crypto.createHash('md5').update(s, 'utf8').digest('hex')
}

function signPay(params: { name: string; pay_type: string; price: string; order_id: string; notify_url: string }): string {
  const raw = params.name + params.pay_type + params.price + params.order_id + params.notify_url + SECRET
  return md5(raw)
}

function verifyCallbackSign(params: { aoid: string; order_id: string; pay_price: string; pay_time: string }): string {
  const raw = params.aoid + params.order_id + params.pay_price + params.pay_time + SECRET
  return md5(raw)
}

function cacheKey(unlockToken: string, recordId: string): string {
  return `${unlockToken}:${recordId}`
}

export async function isOrderPaid(typeCode: string, unlockToken: string, recordId?: string): Promise<boolean> {
  const code = typeCode.toUpperCase()
  if (!unlockToken || !recordId) return false
  if (paidOrdersCache.get(cacheKey(unlockToken, recordId)) === code) return true

  const order = await prisma.paymentOrder.findUnique({ where: { unlockToken } }).catch(() => null)
  if (order?.paid && order.typeCode === code && order.recordId === recordId) {
    paidOrdersCache.set(cacheKey(unlockToken, recordId), code)
    return true
  }
  return false
}

async function createPaymentOrder(orderId: string, typeCode: string, unlockToken: string, email?: string, referralCode?: string, recordId?: string): Promise<void> {
  await prisma.paymentOrder.create({
    data: {
      orderId,
      typeCode: typeCode.toUpperCase(),
      unlockToken,
      email: email || null,
      referralCode: referralCode || null,
      recordId: recordId || null,
    },
  })
}

type PaidOrderInfo = {
  orderId: string
  typeCode: string
  unlockToken: string
  email: string | null
  referralCode: string | null
  recordId: string | null
  emailSentAt: Date | null
}

async function markPaid(orderId: string): Promise<PaidOrderInfo | null> {
  const order = await prisma.paymentOrder.update({
    where: { orderId },
    data: { paid: true, paidAt: new Date() },
  }).catch(() => null)
  if (!order) return null
  if (order.recordId) paidOrdersCache.set(cacheKey(order.unlockToken, order.recordId), order.typeCode)
  return {
    orderId: order.orderId,
    typeCode: order.typeCode,
    unlockToken: order.unlockToken,
    email: order.email,
    referralCode: order.referralCode,
    recordId: order.recordId,
    emailSentAt: order.emailSentAt,
  }
}

export async function sendPaidReportEmail(order: Pick<PaidOrderInfo, 'orderId' | 'typeCode' | 'email' | 'emailSentAt'>): Promise<boolean> {
  if (order.emailSentAt) return true
  try {
    const locked = await prisma.paymentOrder.updateMany({
      where: { orderId: order.orderId, emailSentAt: null },
      data: { emailSentAt: new Date(), emailSendError: 'sending' },
    })
    if (locked.count === 0) return true

    const { sendPaymentEmail } = await import('../services/email.js')
    const sent = await sendPaymentEmail(order.typeCode, order.email || undefined)
    await prisma.paymentOrder.update({
      where: { orderId: order.orderId },
      data: sent
        ? { emailSendError: null }
        : { emailSentAt: null, emailSendError: 'email not sent: SMTP not configured, recipient email missing, or email service returned false' },
    })
    return sent
  } catch (err) {
    await prisma.paymentOrder.update({
      where: { orderId: order.orderId },
      data: { emailSentAt: null, emailSendError: err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500) },
    }).catch(() => {})
    console.error('[payment] paid report email send failed:', err)
    return false
  }
}

paymentRoutes.post('/create', async (req, res, next) => {
  try {
    const { typeCode, typeName, email, referralCode, recordId } = req.body as { typeCode?: string; typeName?: string; email?: string; referralCode?: string; recordId?: string }
    if (!typeCode || !typeName) {
      res.status(400).json({ success: false, error: 'typeCode and typeName required' })
      return
    }
    if (!AID || !SECRET) {
      res.status(500).json({ success: false, error: 'XORPAY not configured' })
      return
    }

    const normalizedTypeCode = typeCode.toUpperCase()
    const eligibilityError = await validateCompleteHighConfidenceRecord(recordId, normalizedTypeCode)
    if (eligibilityError) {
      res.status(400).json({ success: false, error: eligibilityError })
      return
    }

    const unlockToken = crypto.randomBytes(24).toString('hex')
    const orderId = `mbtipro_${normalizedTypeCode}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
    const price = '4.90'
    const payType = (process.env.XORPAY_PAY_TYPE as string) || 'alipay'
    await createPaymentOrder(orderId, normalizedTypeCode, unlockToken, email, referralCode, recordId)

    const orderName = `MBTI-PRO ${normalizedTypeCode} 深度人格报告`
    const sign = signPay({ name: orderName, pay_type: payType, price, order_id: orderId, notify_url: NOTIFY_URL })
    const body = new URLSearchParams({ name: orderName, pay_type: payType, price, order_id: orderId, notify_url: NOTIFY_URL, sign })

    const xorRes = await fetch(`${XORPAY_BASE}/pay/${AID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    const data = await xorRes.json() as { status: string; aoid?: string; info?: { qr?: string } }

    if (data.status === 'ok' && data.info?.qr) {
      res.json({ success: true, data: { qrUrl: data.info.qr, orderId, aoid: data.aoid, unlockToken, expiresIn: 7200 } })
      return
    }
    if (data.status === 'order_payed') {
      const paidOrder = await markPaid(orderId)
      if (paidOrder) sendPaidReportEmail(paidOrder).catch(err => console.error('[payment] email send error:', err))
      res.json({ success: true, data: { paid: true, unlockToken } })
      return
    }

    res.status(500).json({ success: false, error: data.status || 'payment_failed' })
  } catch (err) {
    next(err)
  }
})

paymentRoutes.post('/callback', async (req, res, next) => {
  try {
    const { aoid, order_id, pay_price, pay_time, sign } = req.body as Record<string, string>
    const expectedSign = verifyCallbackSign({ aoid, order_id, pay_price, pay_time })
    if (sign !== expectedSign) {
      console.error('[payment] sign verification failed')
      res.status(400).send('sign error')
      return
    }

    const paidOrder = await markPaid(order_id)
    if (paidOrder) {
      console.log(`[payment] ${paidOrder.typeCode} 支付成功 ¥${pay_price}`)
      sendPaidReportEmail(paidOrder).catch(err => console.error('[payment] email send error:', err))
      if (paidOrder.referralCode && paidOrder.recordId) {
        markReferralPaid(paidOrder.referralCode, paidOrder.recordId).catch(err => console.error('[payment] referral paid count error:', err))
      }
    }

    res.send('ok')
  } catch (err) {
    next(err)
  }
})

paymentRoutes.get('/check/:typeCode', async (req, res) => {
  const typeCode = req.params.typeCode.toUpperCase()
  const unlockToken = typeof req.query.token === 'string' ? req.query.token : ''
  const recordId = typeof req.query.recordId === 'string' ? req.query.recordId : ''
  const paid = await isOrderPaid(typeCode, unlockToken, recordId)

  if (paid) {
    const order = await prisma.paymentOrder.findUnique({
      where: { unlockToken },
      select: { orderId: true, typeCode: true, email: true, emailSentAt: true, recordId: true },
    }).catch(() => null)
    if (order && order.typeCode === typeCode && order.recordId === recordId && !order.emailSentAt) {
      sendPaidReportEmail(order).catch(err => console.error('[payment] email resend error:', err))
    }
  }

  res.json({ success: true, data: { paid } })
})
