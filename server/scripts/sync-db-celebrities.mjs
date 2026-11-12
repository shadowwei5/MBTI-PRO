/**
 * 把数据库里 personality_types.celebrities 列就地更新为 CELEBRITY_MAP 的最新名单。
 *
 * 不删表、不动其它字段，只改这一列。用于数据修正后同步已上线的库
 * （重新跑 seed 会清空整库，线上不要那么做）。
 *
 * 用法：cd server && npx tsx scripts/sync-db-celebrities.mjs [--dry]
 */
import { PrismaClient } from '@prisma/client'
import { getCelebrityNames } from '../src/content/types.ts'

const DRY = process.argv.includes('--dry')
const prisma = new PrismaClient()

const types = await prisma.personalityType.findMany({ select: { code: true, celebrities: true } })
console.log(`库中类型 ${types.length} 个`)

let changed = 0
for (const t of types) {
  const before = JSON.parse(t.celebrities || '[]')
  const after = getCelebrityNames(t.code, before)
  if (before.join() === after.join()) continue
  changed++
  console.log(`  ${t.code}  ${before.join('、') || '（空）'}  →  ${after.join('、')}`)
  if (!DRY) {
    await prisma.personalityType.update({
      where: { code: t.code },
      data: { celebrities: JSON.stringify(after) },
    })
  }
}
console.log(DRY ? `（--dry）需更新 ${changed} 个` : `已更新 ${changed} 个`)
await prisma.$disconnect()
