/**
 * MBTI-PRO 评分引擎
 *
 * 维度：E_I, S_N, T_F, P_J，每维三级分类。
 *
 * Likert 双极题：A=+2, B=+1, C=0, D=-1, E=-2（左侧正向 → 右侧负向）
 *  - E_I：正分为 E，负分为 I
 *  - S_N：正分为 S，负分为 N（题库左侧为 S）
 *  - T_F：正分为 T，负分为 F
 *  - P_J：正分为 J，负分为 P
 *  - 中间档：A / B / C / D
 *
 * 阈值按每个维度的最大可能分动态计算，默认取最大分的 34%。
 *  - 40 题版：每维 10 题，最大 ±20，边界 ±7
 *  - 旧 100 题版：每维最大 ±50，边界 ±17
 *
 * T_F 的客观题仅在题库实际包含 objective 题时参与计分；
 * 40 题首发版已移除逻辑题，避免把推理能力误当成人格偏好。
 */

export interface QuestionMeta {
  id: number
  dimension: 'E_I' | 'S_N' | 'T_F' | 'P_J'
  type: 'likert' | 'objective'
  correctAnswer: string | null
}

export type AnswerKey = 'A' | 'B' | 'C' | 'D' | 'E'
export type Answers = Record<number, AnswerKey | undefined>

export interface DimensionScores {
  E_I: number
  S_N: number
  T_F: number
  P_J: number
  /** T_F 主观分项（便于前端展示分布） */
  T_F_sub: number
  /** T_F 客观分项 */
  T_F_obj: number
}

export interface DimensionChars {
  E_I: 'E' | 'A' | 'I'
  S_N: 'N' | 'B' | 'S'
  T_F: 'T' | 'C' | 'F'
  P_J: 'J' | 'D' | 'P'
}

export interface ScoreResult {
  typeCode: string
  scores: DimensionScores
  chars: DimensionChars
  /** 各维度回答数 */
  dimAnswered: { E_I: number; S_N: number; T_F: number; P_J: number }
  /** 各维度题目总数 */
  dimTotals: { E_I: number; S_N: number; T_F: number; P_J: number }
  /**
   * 各维度实际参与计分的题数。
   * 阈值必须基于这个值，而不是 dimTotals —— 因为得分范围只由真正作答的题目决定。
   * 用 dimTotals 会让阈值被放大（例如题库残留 25 题时阈值变成 ±17，
   * 实际只答了 10 题最多 ±20，几乎所有得分都落进中间档，结果永远是 ABCD）。
   */
  dimScored: { E_I: number; S_N: number; T_F: number; P_J: number }
  /** 各维度三级分类边界（绝对值） */
  thresholds: { E_I: number; S_N: number; T_F: number; P_J: number }
  /**
   * 置信度（0-1）：四维度归一化得分到最近三级阈值的平均距离。
   * 离阈值越远（落在某一级深处），置信度越高。
   */
  confidence: number
}

const LIKERT_VALUE: Record<AnswerKey, number> = { A: 2, B: 1, C: 0, D: -1, E: -2 }
const NEUTRAL_RATIO = 0.34

/** 客观题：答对 +2，答错 -2，超时 -2，未答且未超时 0 */
function scoreObjective(answer: AnswerKey | undefined, correct: string | null, timedOut: boolean): number {
  if (!correct) return 0
  if (!answer) return timedOut ? -2 : 0
  return answer === correct ? 2 : -2
}

export function thresholdFor(dimTotal: number): number {
  if (dimTotal <= 0) return 1
  return Math.max(1, Math.round(dimTotal * 2 * NEUTRAL_RATIO))
}

function classifyDimension(score: number, dim: 'E_I' | 'S_N' | 'P_J', threshold: number): string {
  // S_N 的题库左侧是 S（实感），不是 N；其余维度左侧分别是 E/T/J。
  if (score > threshold) return dim === 'E_I' ? 'E' : dim === 'S_N' ? 'S' : 'J'
  if (score < -threshold) return dim === 'E_I' ? 'I' : dim === 'S_N' ? 'N' : 'P'
  return dim === 'E_I' ? 'A' : dim === 'S_N' ? 'B' : 'D'
}

function classifyTF(score: number, threshold: number): 'T' | 'C' | 'F' {
  if (score > threshold) return 'T'
  if (score < -threshold) return 'F'
  return 'C'
}

function computeConfidence(scores: DimensionScores, dimScored: ScoreResult['dimScored']): number {
  const distances: number[] = []

  for (const dim of ['E_I', 'S_N', 'T_F', 'P_J'] as const) {
    const max = dimScored[dim] * 2 || 1
    const threshold = thresholdFor(dimScored[dim])
    const s = scores[dim]
    const distToThreshold = s > threshold
      ? s - threshold
      : s < -threshold
        ? -threshold - s
        : Math.min(threshold - s, s + threshold)
    distances.push(Math.max(0, distToThreshold) / max)
  }

  const avg = distances.reduce((a, b) => a + b, 0) / distances.length
  return Math.min(1, Math.max(0, avg))
}

export function calculateScore(
  answers: Answers,
  questions: QuestionMeta[],
  timedOut: Record<number, boolean> = {},
): ScoreResult {
  const scores: DimensionScores = { E_I: 0, S_N: 0, T_F: 0, P_J: 0, T_F_sub: 0, T_F_obj: 0 }
  const dimAnswered = { E_I: 0, S_N: 0, T_F: 0, P_J: 0 }
  const dimTotals = { E_I: 0, S_N: 0, T_F: 0, P_J: 0 }
  const dimScored = { E_I: 0, S_N: 0, T_F: 0, P_J: 0 }

  for (const q of questions) {
    dimTotals[q.dimension]++
    const a = answers[q.id]

    if (q.type === 'objective') {
      if (a) { dimAnswered[q.dimension]++; dimScored[q.dimension]++ }
      scores.T_F_obj += scoreObjective(a, q.correctAnswer, timedOut[q.id] ?? false)
    } else {
      // likert：未答跳过（不计分也不计入 answered）
      if (!a) continue
      dimAnswered[q.dimension]++
      dimScored[q.dimension]++
      const v = LIKERT_VALUE[a] ?? 0
      if (q.dimension === 'T_F') scores.T_F_sub += v
      else scores[q.dimension] += v
    }
  }

  scores.T_F = scores.T_F_sub + scores.T_F_obj

  // 阈值基于实际计分题数，而不是题目总数
  const thresholds = {
    E_I: thresholdFor(dimScored.E_I),
    S_N: thresholdFor(dimScored.S_N),
    T_F: thresholdFor(dimScored.T_F),
    P_J: thresholdFor(dimScored.P_J),
  }

  const chars: DimensionChars = {
    E_I: classifyDimension(scores.E_I, 'E_I', thresholds.E_I) as DimensionChars['E_I'],
    S_N: classifyDimension(scores.S_N, 'S_N', thresholds.S_N) as DimensionChars['S_N'],
    T_F: classifyTF(scores.T_F, thresholds.T_F),
    P_J: classifyDimension(scores.P_J, 'P_J', thresholds.P_J) as DimensionChars['P_J'],
  }

  const typeCode = chars.E_I + chars.S_N + chars.T_F + chars.P_J

  return {
    typeCode,
    scores,
    chars,
    dimAnswered,
    dimTotals,
    dimScored,
    thresholds,
    confidence: computeConfidence(scores, dimScored),
  }
}
