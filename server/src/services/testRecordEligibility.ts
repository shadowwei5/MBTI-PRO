import { prisma } from '../index.js'

export type TestRecordEligibility = {
  id: string
  typeCode: string
  confidence: number | null
  dimAnswered: string | null
  dimTotals: string | null
}

const DIMENSIONS = ['E_I', 'S_N', 'T_F', 'P_J'] as const

function parseCounts(value: string | null): Record<string, number> {
  if (!value) return {}
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>
    const counts: Record<string, number> = {}
    for (const [key, raw] of Object.entries(parsed)) {
      if (typeof raw === 'number' && Number.isFinite(raw)) counts[key] = raw
    }
    return counts
  } catch {
    return {}
  }
}

export function getCompleteHighConfidenceError(record: TestRecordEligibility | null, typeCode?: string): string | null {
  if (!record) return '未找到本次测试记录，请重新完整完成测试后再操作。'
  if (typeCode && record.typeCode !== typeCode.toUpperCase()) return '测试记录与当前人格结果不匹配，请重新完整测试后再操作。'

  const answered = parseCounts(record.dimAnswered)
  const totals = parseCounts(record.dimTotals)
  const complete = DIMENSIONS.every(dim => {
    const total = totals[dim]
    return typeof total === 'number' && total > 0 && (answered[dim] ?? 0) >= total
  })
  if (!complete) return '请认真完成所有题目后再提交，未完成测试不会生成真实结果，也不能解锁深度报告。'
  if ((record.confidence ?? 0) < 92) return '本次测试置信度低于 92%，暂不能解锁深度报告。请认真完成所有题目后重新测试。'
  return null
}

export async function findRecordEligibility(recordId: string | undefined | null): Promise<TestRecordEligibility | null> {
  if (!recordId) return null
  return prisma.testRecord.findUnique({
    where: { id: recordId },
    select: { id: true, typeCode: true, confidence: true, dimAnswered: true, dimTotals: true },
  })
}

export async function validateCompleteHighConfidenceRecord(recordId: string | undefined | null, typeCode?: string): Promise<string | null> {
  const record = await findRecordEligibility(recordId)
  return getCompleteHighConfidenceError(record, typeCode)
}
