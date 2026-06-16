/**
 * MBTI-PRO 评分引擎
 *
 * 维度：E_I, S_N, T_F, P_J，每维三级分类。
 *
 * Likert 双极题：A=+2, B=+1, C=0, D=-1, E=-2（左侧正向 → 右侧负向）
 *  - 正分 → 左侧倾向 (E/N/T/J)
 *  - 负分 → 右侧倾向 (I/S/F/P)
 *  - 中区 → 平衡型 (A/B/C/D)
 *
 * T_F 维度由两路汇合：
 *  - 主观 likert（10 题，范围 [-20, +20]）
 *  - 客观推理（20 题，答对 +2 / 答错或未答 -2，范围 [-40, +40]）
 *  实测计入：主观 + 客观，总范围 [-60, +60]
 *
 * 三级阈值（参考 references/05-评分算法参考.md）：
 *  - E_I/S_N/P_J: < -17 / [-17, +16] / > +16
 *  - T_F:         < 10 / [10, 29]   / > 29   （依据正态假设，T_F 期望偏向 T 侧）
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
   * 置信度（0-1）：四维度归一化得分到最近三级阈值的平均距离。
   * 离阈值越远（落在某一级深处），置信度越高。
   */
  confidence: number
}

const LIKERT_VALUE: Record<AnswerKey, number> = { A: 2, B: 1, C: 0, D: -1, E: -2 }

/** 客观题：答对 +2，答错或未答 -2 */
function scoreObjective(answer: AnswerKey | undefined, correct: string | null): number {
  if (!correct) return 0
  return answer === correct ? 2 : -2
}

function classifySymmetric(score: number, dim: 'E_I' | 'S_N' | 'P_J'): string {
  if (score > 16) return dim === 'E_I' ? 'E' : dim === 'S_N' ? 'N' : 'J'
  if (score < -17) return dim === 'E_I' ? 'I' : dim === 'S_N' ? 'S' : 'P'
  return dim === 'E_I' ? 'A' : dim === 'S_N' ? 'B' : 'D'
}

function classifyTF(score: number): 'T' | 'C' | 'F' {
  if (score > 29) return 'T'
  if (score < 10) return 'F'
  return 'C'
}

function computeConfidence(scores: DimensionScores, dimTotals: ScoreResult['dimTotals']): number {
  const distances: number[] = []

  // E_I/S_N/P_J: 最近阈值距离 / 最大可能分（dimTotals×2）
  for (const dim of ['E_I', 'S_N', 'P_J'] as const) {
    const max = dimTotals[dim] * 2 || 1
    const s = scores[dim]
    const distToThreshold = s > 16 ? s - 16 : s < -17 ? -17 - s : Math.min(16 - s, s + 17)
    distances.push(Math.max(0, distToThreshold) / max)
  }

  // T_F: 阈值 10 / 29，最大可能分 = (likert题×2) + (obj题×2)
  const tfMax = dimTotals.T_F * 2 || 1
  const t = scores.T_F
  const distTF = t > 29 ? t - 29 : t < 10 ? 10 - t : Math.min(29 - t, t - 10)
  distances.push(Math.max(0, distTF) / tfMax)

  const avg = distances.reduce((a, b) => a + b, 0) / distances.length
  return Math.min(1, Math.max(0, avg))
}

export function calculateScore(answers: Answers, questions: QuestionMeta[]): ScoreResult {
  const scores: DimensionScores = { E_I: 0, S_N: 0, T_F: 0, P_J: 0, T_F_sub: 0, T_F_obj: 0 }
  const dimAnswered = { E_I: 0, S_N: 0, T_F: 0, P_J: 0 }
  const dimTotals = { E_I: 0, S_N: 0, T_F: 0, P_J: 0 }

  for (const q of questions) {
    dimTotals[q.dimension]++
    const a = answers[q.id]

    if (q.type === 'objective') {
      // 客观题：答对/答错/未答都"参与计分"，但仅当用户作答才计入 dimAnswered
      if (a) dimAnswered[q.dimension]++
      scores.T_F_obj += scoreObjective(a, q.correctAnswer)
    } else {
      // likert：未答跳过（不计分也不计入 answered）
      if (!a) continue
      dimAnswered[q.dimension]++
      const v = LIKERT_VALUE[a] ?? 0
      if (q.dimension === 'T_F') scores.T_F_sub += v
      else scores[q.dimension] += v
    }
  }

  scores.T_F = scores.T_F_sub + scores.T_F_obj

  const chars: DimensionChars = {
    E_I: classifySymmetric(scores.E_I, 'E_I') as DimensionChars['E_I'],
    S_N: classifySymmetric(scores.S_N, 'S_N') as DimensionChars['S_N'],
    T_F: classifyTF(scores.T_F),
    P_J: classifySymmetric(scores.P_J, 'P_J') as DimensionChars['P_J'],
  }

  const typeCode = chars.E_I + chars.S_N + chars.T_F + chars.P_J

  return {
    typeCode,
    scores,
    chars,
    dimAnswered,
    dimTotals,
    confidence: computeConfidence(scores, dimTotals),
  }
}
