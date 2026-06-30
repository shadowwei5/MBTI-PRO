import { Router } from 'express'
import crypto from 'crypto'

export const paymentRoutes = Router()

const XORPAY_BASE = 'https://xorpay.com/api'
const AID = process.env.XORPAY_AID || ''
const SECRET = process.env.XORPAY_SECRET || ''
const NOTIFY_URL = process.env.XORPAY_NOTIFY_URL || ''

function md5(s: string): string {
  return crypto.createHash('md5').update(s, 'utf8').digest('hex')
}

// XORPAY 统一下单签名: name + pay_type + price + order_id + notify_url + secret
function signPay(params: { name: string; pay_type: string; price: string; order_id: string; notify_url: string }): string {
  const raw = params.name + params.pay_type + params.price + params.order_id + params.notify_url + SECRET
  return md5(raw)
}

// 回调验签: aoid + order_id + pay_price + pay_time + secret
function verifyCallbackSign(params: { aoid: string; order_id: string; pay_price: string; pay_time: string }): string {
  const raw = params.aoid + params.order_id + params.pay_price + params.pay_time + SECRET
  return md5(raw)
}

// 已支付订单：按订单解锁，避免同一人格类型被全站共享解锁
const paidOrdersCache = new Map<string, string>()

export async function isOrderPaid(typeCode: string, unlockToken: string): Promise<boolean> {
  const code = typeCode.toUpperCase()
  if (paidOrdersCache.get(unlockToken) === code) return true
  try {
    const { prisma } = await import('../index.js')
    const record = await prisma.paymentOrder.findUnique({ where: { unlockToken } })
    if (record?.paid && record.typeCode === code) {
      paidOrdersCache.set(unlockToken, code)
      return true
    }
  } catch { /* DB不可用时降级到内存 */ }
  return false
}

async function createPaymentOrder(orderId: string, typeCode: string, unlockToken: string): Promise<void> {
  const code = typeCode.toUpperCase()
  const { prisma } = await import('../index.js')
  await prisma.paymentOrder.create({
    data: { orderId, typeCode: code, unlockToken },
  })
}

async function markPaid(orderId: string): Promise<string | null> {
  try {
    const { prisma } = await import('../index.js')
    const order = await prisma.paymentOrder.update({
      where: { orderId },
      data: { paid: true, paidAt: new Date() },
    })
    paidOrdersCache.set(order.unlockToken, order.typeCode)
    return order.typeCode
  } catch {
    return null
  }
}

// POST /api/payment/create — 创建支付订单，返回二维码
paymentRoutes.post('/create', async (req, res, next) => {
  try {
    const { typeCode, typeName } = req.body as { typeCode?: string; typeName?: string }
    if (!typeCode || !typeName) {
      res.status(400).json({ success: false, error: 'typeCode and typeName required' })
      return
    }

    if (!AID || !SECRET) {
      res.status(500).json({ success: false, error: 'XORPAY not configured' })
      return
    }

    const normalizedTypeCode = typeCode.toUpperCase()
    const unlockToken = crypto.randomBytes(24).toString('hex')
    const orderId = `mbtipro_${normalizedTypeCode}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
    const price = '4.90'
    const payType = (process.env.XORPAY_PAY_TYPE as string) || 'alipay' // 微信扫码；alipay 为支付宝当面付
    await createPaymentOrder(orderId, normalizedTypeCode, unlockToken)

    const sign = signPay({
      name: `MBTI-PRO ${normalizedTypeCode} 深度人格报告`,
      pay_type: payType,
      price,
      order_id: orderId,
      notify_url: NOTIFY_URL
    })

    const body = new URLSearchParams({
      name: `MBTI-PRO ${normalizedTypeCode} 深度人格报告`,
      pay_type: payType,
      price,
      order_id: orderId,
      notify_url: NOTIFY_URL,
      sign,
    })

    const xorRes = await fetch(`${XORPAY_BASE}/pay/${AID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    const data = await xorRes.json() as {
      status: string
      aoid?: string
      info?: { qr?: string }
    }

    if (data.status === 'ok' && data.info?.qr) {
      res.json({
        success: true,
        data: {
          qrUrl: data.info.qr,
          orderId,
          aoid: data.aoid,
          unlockToken,
          expiresIn: 7200,
        },
      })
    } else if (data.status === 'order_payed') {
      await markPaid(orderId)
      res.json({ success: true, data: { paid: true, unlockToken } })
    } else {
      res.status(500).json({ success: false, error: data.status || 'payment_failed' })
    }
  } catch (err) {
    next(err)
  }
})

// POST /api/payment/callback — XorPay 支付成功回调
paymentRoutes.post('/callback', async (req, res, next) => {
  try {
    const { aoid, order_id, pay_price, pay_time, sign, more } = req.body as Record<string, string>

    // 验签
    const expectedSign = verifyCallbackSign({ aoid, order_id, pay_price, pay_time })
    if (sign !== expectedSign) {
      console.error('[payment] sign verification failed')
      res.status(400).send('sign error')
      return
    }

    const code = await markPaid(order_id)
    if (code) {
      console.log(`[payment] ${code} 支付成功 ¥${pay_price}`)

      // 异步发送邮件（不阻塞回调响应）
      import("../services/email.js").then(({ sendPaymentEmail }) =>
        sendPaymentEmail(code)
      ).catch(err =>
        console.error("[payment] email send error:", err)
      )
    }

    res.send('ok')
  } catch (err) {
    next(err)
  }
})

// GET /api/payment/check/:typeCode — 检查当前订单是否已支付
paymentRoutes.get('/check/:typeCode', async (req, res) => {
  const typeCode = req.params.typeCode.toUpperCase()
  const unlockToken = typeof req.query.token === 'string' ? req.query.token : ''
  const paid = unlockToken ? await isOrderPaid(typeCode, unlockToken) : false
  res.json({ success: true, data: { paid } })
})
