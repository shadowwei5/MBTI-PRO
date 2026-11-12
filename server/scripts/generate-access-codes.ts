/**
 * 批量生成小红书 0.99 元商品兑换码
 *
 * 用法：
 *   cd server
 *   npx tsx scripts/generate-access-codes.ts --count 100 --batch xhs-2026-11
 *
 * 码格式（默认）：**5 位纯数字**（对标店铺 4-5 位数字验证码习惯），如 82417。
 *   --style numeric|alnum   默认 numeric；alnum 为旧的 MBTI-XXXX-XXXX-XXXX 格式
 *   --digits 4|5|6          numeric 模式的位数，默认 5（不会以 0 开头，防止 Excel 吞前导零）
 *   --count / --batch / --max-redemptions / --days 同旧版
 *
 * 安全性：redeem 接口自带同 IP 10 分钟 30 次尝试的限速（routes/access.ts），
 * 5 位数字（9 万空间）在该限速下不可被穷举。
 *
 * 输出：
 *   server/access-codes/<batch>-<timestamp>.csv
 *
 * 注意：
 * - 该目录已加入 .gitignore，生成文件不要提交；
 * - 每个码默认可在 3 台设备/浏览器兑换，有效期 180 天；
 * - 需要停用某个码时，直接把 AccessCode.disabled 设为 true。
 * - 线上码池必须在服务器上生成（连的是服务器 SQLite）：见上架文档 §四。
 */

import crypto from 'crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.resolve(__dirname, '..', 'access-codes')

function arg(name: string, fallback: string): string {
  const idx = process.argv.indexOf(`--${name}`)
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback
}

const count = Math.max(1, Math.min(5000, Number(arg('count', '100')) || 100))
const batch = arg('batch', `xhs-${new Date().toISOString().slice(0, 10)}`)
const style = arg('style', 'numeric').toLowerCase() === 'alnum' ? 'alnum' : 'numeric'
const digits = Math.max(4, Math.min(6, Number(arg('digits', '5')) || 5))
const prefix = arg('prefix', 'MBTI').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'MBTI'
const maxRedemptions = Math.max(1, Math.min(10, Number(arg('max-redemptions', '3')) || 3))
const days = Math.max(1, Math.min(730, Number(arg('days', '180')) || 180))

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function randomBlock(length = 4): string {
  let out = ''
  for (let i = 0; i < length; i++) out += ALPHABET[crypto.randomInt(0, ALPHABET.length)]
  return out
}

function makeCode(): string {
  if (style === 'alnum') return `${prefix}-${randomBlock()}-${randomBlock()}-${randomBlock()}`
  // 取 [10^(d-1), 10^d) 区间，位数恒定且永不为 0 开头 → CSV/Excel 不会吞前导零
  const min = 10 ** (digits - 1)
  return String(crypto.randomInt(min, min * 10))
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000)

  // 数字码空间小（5 位 = 9 万），必须与库内已有码（含历史 alnum 长码）去重
  const existing = new Set(
    (await prisma.accessCode.findMany({ select: { code: true } })).map(r => r.code),
  )
  const codes = new Set<string>()
  let guard = 0
  while (codes.size < count) {
    const c = makeCode()
    if (!existing.has(c)) codes.add(c)
    if (++guard > count * 200) throw new Error(`码空间不足：${style}/${digits} 位无法生成 ${count} 个不重复码`)
  }

  const data = [...codes].map(code => ({
    code,
    batch,
    maxRedemptions,
    expiresAt,
    note: `generated ${new Date().toISOString()}`,
  }))

  await prisma.accessCode.createMany({ data })

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const file = path.join(OUT_DIR, `${batch}-${stamp}.csv`)
  const header = 'code,batch,maxRedemptions,expiresAt\n'
  const body = data.map(item => [
    item.code,
    item.batch,
    item.maxRedemptions,
    item.expiresAt.toISOString(),
  ].join(',')).join('\n')
  fs.writeFileSync(file, header + body + '\n', 'utf8')

  console.log(`已生成 ${data.length} 个兑换码`)
  console.log(`格式: ${style === 'numeric' ? `${digits} 位纯数字` : 'alnum 长码'}`)
  console.log(`批次: ${batch}`)
  console.log(`每码可兑换: ${maxRedemptions} 次`)
  console.log(`有效期至: ${expiresAt.toISOString()}`)
  console.log(`示例: ${data.slice(0, 3).map(d => d.code).join(' / ')}`)
  console.log(`CSV: ${file}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
