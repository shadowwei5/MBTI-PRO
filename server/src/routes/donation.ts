import { Router } from 'express'
import crypto from 'crypto'
import { loadServerEnv } from '../config/env.js'

export const donationRoutes = Router()

loadServerEnv()

const XORPAY_BASE = 'https://xorpay.com/api'
const AID = process.env.XORPAY_AID || ''
const SECRET = process.env.XORPAY_SECRET || ''
const NOTIFY_URL = process.env.XORPAY_NOTIFY_URL || ''

function md5(s: string): string {
  return crypto.createHash('md5').update(s, 'utf8').digest('hex')
}

function signPay(params: { name: string; pay_type: string; price: string; order_id: string; notify_url: string }): string {
  return md5(params.name + params.pay_type + params.price + params.order_id + params.notify_url + SECRET)
}

const ERROR_MESSAGES: Record<string, string> = {
  fee_error: 'XorPay 平台余额不足，暂时无法生成收款码，请稍后再试。',
  sign_error: '支付签名校验失败，请联系作者检查配置。',
  app_off: '支付账号已被冻结，请联系作者。',
  aid_not_exist: '支付配置有误（aid 不存在），请联系作者。',
  pay_type_error: '不支持的支付方式，请切换后重试。',
  order_exist: '订单号冲突，请重新生成收款码。',
  order_expire: '订单已过期，请重新生成收款码。',
  missing_argument: '下单参数缺失，请联系作者。',
}

function friendlyError(status: string): string {
  return ERROR_MESSAGES[status] || `生成收款码失败（${status}），请稍后重试。`
}

donationRoutes.post('/create', async (req, res, next) => {
  try {
    const { amount, payType } = req.body as { amount?: number; payType?: string }

    const num = Number(amount)
    if (!Number.isFinite(num) || num < 0.01 || num > 500) {
      res.status(400).json({ success: false, error: '打赏金额需在 ¥0.01 ~ ¥500 之间' })
      return
    }

    const payTypeNormalized = payType === 'native' ? 'native' : 'alipay'

    if (!AID || !SECRET) {
      res.status(500).json({ success: false, error: 'XorPay 未配置，无法生成收款码' })
      return
    }

    const price = num.toFixed(2)
    const orderId = `donation_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
    const orderName = 'MBTI-PRO 打赏'
    const sign = signPay({ name: orderName, pay_type: payTypeNormalized, price, order_id: orderId, notify_url: NOTIFY_URL })
    const body = new URLSearchParams({
      name: orderName,
      pay_type: payTypeNormalized,
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
    const data = await xorRes.json() as { status: string; aoid?: string; info?: { qr?: string } }

    if (data.status === 'ok' && data.info?.qr && data.aoid) {
      res.json({ success: true, data: { qrUrl: data.info.qr, aoid: data.aoid, orderId, expiresIn: 7200 } })
      return
    }
    if (data.status === 'order_payed') {
      res.json({ success: true, data: { paid: true, orderId } })
      return
    }

    res.status(500).json({ success: false, error: friendlyError(data.status) })
  } catch (err) {
    next(err)
  }
})

donationRoutes.get('/check/:aoid', async (req, res, next) => {
  try {
    const aoid = req.params.aoid
    if (!aoid) {
      res.status(400).json({ success: false, error: '缺少订单号' })
      return
    }

    const queryRes = await fetch(`${XORPAY_BASE}/query/${encodeURIComponent(aoid)}`)
    const data = await queryRes.json() as { status: string }
    const status = data.status
    const paid = status === 'payed' || status === 'success'

    res.json({ success: true, data: { paid, status } })
  } catch (err) {
    next(err)
  }
})