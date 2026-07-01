import nodemailer from 'nodemailer'
import { prisma } from '../index.js'
import { generateReportPdf } from './reportPdf.js'
import { getSmtpPort, getSmtpSecure, hasSmtpConfig } from './smtpConfig.js'
import { loadServerEnv } from '../config/env.js'

loadServerEnv()

// SMTP 配置（使用 QQ 邮箱为例，也可用其他 SMTP 服务）
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.qq.com',
  port: getSmtpPort(),
  secure: getSmtpSecure(),
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
})

function getReportHTML(typeName: string, typeCode: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #2D2A26; background: #F5F2EC;">
  <div style="background: #FFF; border-radius: 20px; padding: 40px 30px; text-align: center;">
    <h1 style="font-size: 28px; font-weight: 700; margin-bottom: 8px;">🎉 你的深度人格报告已解锁</h1>
    <p style="font-size: 15px; color: #6B6560; margin-bottom: 24px;">感谢你完成 MBTI-PRO 测试并解锁深度报告</p>
    <div style="background: #FAF8F5; border-radius: 16px; padding: 24px; margin-bottom: 24px; text-align: center;">
      <p style="font-size: 14px; color: #9C958E; margin-bottom: 4px;">你的人格类型</p>
      <p style="font-size: 32px; font-weight: 700; color: #C8963E; margin: 0;">${typeName}</p>
      <p style="font-size: 13px; color: #9C958E; margin-top: 4px;">${typeCode}</p>
    </div>
    <p style="font-size: 15px; color: #6B6560; line-height: 1.7; margin: 0 0 20px;">完整 PDF 报告已作为附件随邮件发送，你可以下载后长期保存。</p>
    <a href="https://mbti-pro.com/result/${typeCode}" style="display: inline-block; background: #C8963E; color: #FFF; padding: 14px 40px; border-radius: 14px; text-decoration: none; font-size: 16px; font-weight: 700;">回到网页查看</a>
    <p style="font-size: 12px; color: #9C958E; margin-top: 16px;">或复制链接到浏览器：https://mbti-pro.com/result/${typeCode}</p>
  </div>
  <p style="font-size: 12px; color: #9C958E; text-align: center; margin-top: 20px;">
    MBTI-PRO · 81型人格深度解析<br>
    此邮件由系统自动发送，请勿回复
  </p>
</body>
</html>`
}

/**
 * 支付成功后发送深度报告邮件
 */
export async function sendPaymentEmail(typeCode: string, paidEmail?: string): Promise<boolean> {
  // SMTP 未配置时静默跳过
  if (!hasSmtpConfig()) {
    console.log('[email] SMTP not configured, skipping email send')
    return false
  }

  try {
    const normalizedTypeCode = typeCode.toUpperCase()
    const emails = paidEmail
      ? [{ email: paidEmail }]
      : await prisma.userEmail.findMany({
          where: { typeCode: normalizedTypeCode },
          orderBy: { createdAt: 'desc' },
          take: 1,
        })

    if (emails.length === 0) {
      console.log(`[email] No emails found for ${typeCode}`)
      return false
    }

    // 获取人格名称
    const type = await prisma.personalityType.findUnique({
      where: { code: normalizedTypeCode },
      select: { name: true },
    })
    const typeName = type?.name || typeCode
    const pdf = await generateReportPdf(normalizedTypeCode)

    const results = await Promise.allSettled(
      emails.map(e =>
        transporter.sendMail({
          from: `"MBTI-PRO" <${process.env.SMTP_USER}>`,
          to: e.email,
          subject: `🎉 你的 ${typeName}（${normalizedTypeCode}）深度人格报告 PDF`,
          html: getReportHTML(typeName, normalizedTypeCode),
          attachments: [
            {
              filename: `MBTI-PRO-${normalizedTypeCode}-${typeName}-深度人格报告.pdf`,
              content: pdf,
              contentType: 'application/pdf',
            },
          ],
        })
      )
    )

    const sent = results.filter(r => r.status === 'fulfilled').length
    console.log(`[email] ${typeCode}: sent ${sent}/${emails.length} emails`)
    if (sent === 0) {
      const reasons = results
        .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
        .map(r => r.reason instanceof Error ? r.reason.message : String(r.reason))
        .filter(Boolean)
      throw new Error(reasons.length ? reasons.join(' | ').slice(0, 500) : 'email service returned false')
    }
    return true
  } catch (err) {
    console.error('[email] send error:', err)
    throw err
  }
}
