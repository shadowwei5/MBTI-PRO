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

// 已支付订单：先查内存（热缓存），回退数据库
const paidOrdersCache = new Set<string>()

async function isPaid(typeCode: string): Promise<boolean> {
  const code = typeCode.toUpperCase()
  if (paidOrdersCache.has(code)) return true
  try {
    const { prisma } = await import('../index.js')
    const record = await prisma.paymentRecord.findUnique({ where: { typeCode: code } })
    if (record?.paid) {
      paidOrdersCache.add(code)
      return true
    }
  } catch { /* DB不可用时降级到内存 */ }
  return false
}

async function markPaid(typeCode: string): Promise<void> {
  const code = typeCode.toUpperCase()
  paidOrdersCache.add(code)
  try {
    const { prisma } = await import('../index.js')
    await prisma.paymentRecord.upsert({
      where: { typeCode: code },
      update: { paid: true, paidAt: new Date() },
      create: { typeCode: code, paid: true, paidAt: new Date() },
    })
  } catch { /* DB不可用时仅内存 */ }
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

    // 检查是否已支付
    if (await isPaid(typeCode)) {
      res.json({ success: true, paid: true })
      return
    }

    const orderId = `mbtipro_${typeCode}_${Date.now()}`
    const price = '4.90'
    const payType = 'native' // 微信扫码；alipay 为支付宝当面付

    const sign = signPay({
      name: `MBTI-PRO ${typeCode} 深度人格报告`,
      pay_type: payType,
      price,
      order_id: orderId,
      notify_url: NOTIFY_URL
    })

    const body = new URLSearchParams({
      name: `MBTI-PRO ${typeCode} 深度人格报告`,
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
          expiresIn: 7200,
        },
      })
    } else if (data.status === 'order_payed') {
      await markPaid(typeCode)
      res.json({ success: true, paid: true })
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

    // 从 order_id 提取 typeCode
    // order_id 格式: mbtipro_{typeCode}_{timestamp}
    const match = order_id?.match(/^mbtipro_(\w+)_\d+$/)
    if (match) {
      markPaid(match[1].toUpperCase())
      console.log(`[payment] ${match[1]} 支付成功 ¥${pay_price}`)
    }

    res.send('ok')
  } catch (err) {
    next(err)
  }
})

// GET /api/payment/check/:typeCode — 检查是否已支付
paymentRoutes.get('/check/:typeCode', async (req, res) => {
  const typeCode = req.params.typeCode.toUpperCase()
  const paid = await isPaid(typeCode)
  res.json({ success: true, paid })
})
