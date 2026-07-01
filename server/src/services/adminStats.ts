export const ADMIN_DIMENSION_LABELS: Record<string, string> = {
  E_I: '能量来源',
  S_N: '认知方式',
  T_F: '决策方式',
  P_J: '生活态度',
}

export const ADMIN_QUESTION_TYPE_LABELS: Record<string, string> = {
  likert: '主观选择题',
  objective: '客观推理题',
}

export function isValidQuestionTiming(seconds: unknown): seconds is number {
  return typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0 && seconds <= 120
}
