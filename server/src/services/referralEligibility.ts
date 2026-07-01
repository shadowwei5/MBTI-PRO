export function getCreateReferralEligibilityError(record: { typeCode: string; confidence: number | null } | null): string | null {
  if (!record) return '未找到本次测试记录，请重新完成测试后再生成邀请链接。'
  if ((record.confidence ?? 0) < 92) return '本次测试置信度低于 92%，暂不能生成免费解锁邀请链接。请认真完成所有题目后重新提交。'
  return null
}
