/**
 * 批量生成小红书 0.99 元商品兑换码
 *
 * 用法：
 *   cd server
 *   npx tsx scripts/generate-access-codes.ts --count 100 --batch xhs-2026-11 --prefix MBTI
 *
 * 输出：
 *   server/access-codes/<batch>-<timestamp>.csv
 *
 * 注意：
 * - 该目录已加入 .gitignore，生成文件不要提交；
 * - 每个码默认可在 3 台设备/浏览器兑换，有效期 180 天；
 * - 需要停用某个码时，直接把 AccessCode.disabled 设为 true。
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
  return `${prefix}-${randomBlock()}-${randomBlock()}-${randomBlock()}`
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
  const codes = new Set<string>()
  while (codes.size < count) codes.add(makeCode())

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
  console.log(`批次: ${batch}`)
  console.log(`每码可兑换: ${maxRedemptions} 次`)
  console.log(`有效期至: ${expiresAt.toISOString()}`)
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
