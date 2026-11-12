import { describe, it, expect } from 'vitest'
import { calculateScore, thresholdFor, type Answers, type QuestionMeta } from '../scoring.js'

function buildLikert(idStart: number, dim: QuestionMeta['dimension'], n: number): QuestionMeta[] {
  return Array.from({ length: n }, (_, i) => ({
    id: idStart + i,
    dimension: dim,
    type: 'likert' as const,
    correctAnswer: null,
  }))
}

function buildObjective(idStart: number, n: number, correct: string = 'A'): QuestionMeta[] {
  return Array.from({ length: n }, (_, i) => ({
    id: idStart + i,
    dimension: 'T_F' as const,
    type: 'objective' as const,
    correctAnswer: correct,
  }))
}

function fillAll(qs: QuestionMeta[], key: 'A' | 'B' | 'C' | 'D' | 'E'): Answers {
  return Object.fromEntries(qs.map(q => [q.id, key])) as Answers
}

// 40 题首发版：四维各 10 道 Likert，T_F 不含逻辑题
const SHORT_QUESTIONS: QuestionMeta[] = [
  ...buildLikert(1, 'E_I', 10),
  ...buildLikert(26, 'S_N', 10),
  ...buildLikert(51, 'P_J', 10),
  ...buildLikert(76, 'T_F', 10),
]

// 旧 100 题版：仅用于验证通用阈值和兼容性
const FULL_QUESTIONS: QuestionMeta[] = [
  ...buildLikert(1, 'E_I', 25),
  ...buildLikert(26, 'S_N', 25),
  ...buildLikert(51, 'P_J', 25),
  ...buildLikert(76, 'T_F', 15),
  ...buildObjective(91, 10, 'A'),
]

describe('thresholdFor - 按维度最大分动态计算边界', () => {
  it('10 题维度：最大 ±20，边界 ±7', () => {
    expect(thresholdFor(10)).toBe(7)
  })

  it('25 题维度：最大 ±50，边界 ±17', () => {
    expect(thresholdFor(25)).toBe(17)
  })
})

describe('calculateScore - 40 题版三级分类', () => {
  it('全 A：左侧 E/S/T/J，typeCode = ESTJ', () => {
    const r = calculateScore(fillAll(SHORT_QUESTIONS, 'A'), SHORT_QUESTIONS)
    expect(r.scores.E_I).toBe(20)
    expect(r.scores.S_N).toBe(20)
    expect(r.scores.T_F).toBe(20)
    expect(r.scores.P_J).toBe(20)
    expect(r.chars).toEqual({ E_I: 'E', S_N: 'S', T_F: 'T', P_J: 'J' })
    expect(r.typeCode).toBe('ESTJ')
  })

  it('全 E：右侧 I/N/F/P，typeCode = INFP', () => {
    const r = calculateScore(fillAll(SHORT_QUESTIONS, 'E'), SHORT_QUESTIONS)
    expect(r.scores.E_I).toBe(-20)
    expect(r.scores.S_N).toBe(-20)
    expect(r.scores.T_F).toBe(-20)
    expect(r.scores.P_J).toBe(-20)
    expect(r.chars).toEqual({ E_I: 'I', S_N: 'N', T_F: 'F', P_J: 'P' })
    expect(r.typeCode).toBe('INFP')
  })

  it('全 C：四维均在中间档，typeCode = ABCD', () => {
    const r = calculateScore(fillAll(SHORT_QUESTIONS, 'C'), SHORT_QUESTIONS)
    expect(r.scores.E_I).toBe(0)
    expect(r.scores.S_N).toBe(0)
    expect(r.scores.T_F).toBe(0)
    expect(r.scores.P_J).toBe(0)
    expect(r.chars).toEqual({ E_I: 'A', S_N: 'B', T_F: 'C', P_J: 'D' })
    expect(r.typeCode).toBe('ABCD')
  })

  it('每维边界：+8 为左端，+7 为中间；-7 为中间，-8 为右端', () => {
    const Q = buildLikert(1, 'E_I', 10)

    const plus8: Answers = { 1: 'A', 2: 'A', 3: 'A', 4: 'A' }
    for (let i = 5; i <= 10; i++) plus8[i] = 'C'
    expect(calculateScore(plus8, Q).scores.E_I).toBe(8)
    expect(calculateScore(plus8, Q).chars.E_I).toBe('E')

    const plus7: Answers = { 1: 'A', 2: 'A', 3: 'A', 4: 'B' }
    for (let i = 5; i <= 10; i++) plus7[i] = 'C'
    expect(calculateScore(plus7, Q).scores.E_I).toBe(7)
    expect(calculateScore(plus7, Q).chars.E_I).toBe('A')

    const minus7: Answers = { 1: 'E', 2: 'E', 3: 'E', 4: 'D' }
    for (let i = 5; i <= 10; i++) minus7[i] = 'C'
    expect(calculateScore(minus7, Q).scores.E_I).toBe(-7)
    expect(calculateScore(minus7, Q).chars.E_I).toBe('A')

    const minus8: Answers = { 1: 'E', 2: 'E', 3: 'E', 4: 'E' }
    for (let i = 5; i <= 10; i++) minus8[i] = 'C'
    expect(calculateScore(minus8, Q).scores.E_I).toBe(-8)
    expect(calculateScore(minus8, Q).chars.E_I).toBe('I')
  })

  it('S_N 正向是 S，不是 N', () => {
    const r = calculateScore(fillAll(SHORT_QUESTIONS, 'A'), SHORT_QUESTIONS)
    expect(r.chars.S_N).toBe('S')
  })

  it('T_F 边界：+7 为中间，+8 为 T', () => {
    const Q = buildLikert(1, 'T_F', 10)
    const plus7: Answers = { 1: 'A', 2: 'A', 3: 'A', 4: 'B' }
    for (let i = 5; i <= 10; i++) plus7[i] = 'C'
    expect(calculateScore(plus7, Q).scores.T_F).toBe(7)
    expect(calculateScore(plus7, Q).chars.T_F).toBe('C')

    const plus8: Answers = { 1: 'A', 2: 'A', 3: 'A', 4: 'A' }
    for (let i = 5; i <= 10; i++) plus8[i] = 'C'
    expect(calculateScore(plus8, Q).scores.T_F).toBe(8)
    expect(calculateScore(plus8, Q).chars.T_F).toBe('T')
  })
})

describe('calculateScore - T_F 客观题旧版兼容', () => {
  it('答对 +2，答错 -2，未答且未超时 0', () => {
    const Q = buildObjective(1, 4, 'B')
    expect(calculateScore({ 1: 'B', 2: 'B', 3: 'B', 4: 'B' }, Q).scores.T_F_obj).toBe(8)
    expect(calculateScore({ 1: 'A', 2: 'A', 3: 'A', 4: 'A' }, Q).scores.T_F_obj).toBe(-8)
    expect(calculateScore({}, Q).scores.T_F_obj).toBe(0)
    expect(calculateScore({}, Q, { 1: true, 3: true }).scores.T_F_obj).toBe(-4)
  })
})

describe('calculateScore - 旧 100 题兼容', () => {
  it('全 A：E/S/T/J，typeCode = ESTJ', () => {
    const r = calculateScore(fillAll(FULL_QUESTIONS, 'A'), FULL_QUESTIONS)
    expect(r.scores.E_I).toBe(50)
    expect(r.scores.S_N).toBe(50)
    expect(r.scores.T_F).toBe(50)
    expect(r.scores.P_J).toBe(50)
    expect(r.typeCode).toBe('ESTJ')
  })

  it('全 E：I/N/F/P，typeCode = INFP', () => {
    const r = calculateScore(fillAll(FULL_QUESTIONS, 'E'), FULL_QUESTIONS)
    expect(r.typeCode).toBe('INFP')
  })

  it('全 C：T_F 客观全错 -20 → F', () => {
    const r = calculateScore(fillAll(FULL_QUESTIONS, 'C'), FULL_QUESTIONS)
    expect(r.chars.E_I).toBe('A')
    expect(r.chars.S_N).toBe('B')
    expect(r.chars.T_F).toBe('F')
    expect(r.chars.P_J).toBe('D')
  })
})

describe('calculateScore - 元数据与置信度', () => {
  it('40 题版四维各 10 题', () => {
    const r = calculateScore(fillAll(SHORT_QUESTIONS, 'A'), SHORT_QUESTIONS)
    expect(r.dimTotals).toEqual({ E_I: 10, S_N: 10, T_F: 10, P_J: 10 })
    expect(r.dimAnswered).toEqual({ E_I: 10, S_N: 10, T_F: 10, P_J: 10 })
  })

  it('全极端答案置信度高于全中立', () => {
    const extreme = calculateScore(fillAll(SHORT_QUESTIONS, 'A'), SHORT_QUESTIONS)
    const neutral = calculateScore(fillAll(SHORT_QUESTIONS, 'C'), SHORT_QUESTIONS)
    expect(extreme.confidence).toBeGreaterThan(neutral.confidence)
    expect(neutral.confidence).toBeGreaterThan(0)
  })
})

// 回归测试：2026-11-12 手机端「每次都是 ABCD」
// 现场：用户答满 40 题、其中 29 题选了 E（非常右），结果却是 ABCD。
// 根因：localStorage 里残留旧版 100 题题库，前端用它替换了 API 返回的 40 题，
// 导致 dimTotals 变成 25/25/25/25，阈值被放大到 ±17，
// 而实际只答了 10 题/维（最大 ±20），几乎所有得分都落进中间档。
describe('calculateScore - 题库残留导致的 ABCD 回归', () => {
  it('阈值按实际计分题数算，而不是题目总数', () => {
    const r = calculateScore(fillAll(SHORT_QUESTIONS, 'A'), SHORT_QUESTIONS)
    expect(r.dimScored).toEqual({ E_I: 10, S_N: 10, T_F: 10, P_J: 10 })
    expect(r.thresholds).toEqual({ E_I: 7, S_N: 7, T_F: 7, P_J: 7 })
  })

  it('题库含未作答的 25 题时，答满 10 题仍能判为极端型而非 ABCD', () => {
    // 模拟：题目列表是旧版 25 题/维，但只有 10 题有答案
    const stale = [
      ...buildLikert(1, 'E_I', 25),
      ...buildLikert(26, 'S_N', 25),
      ...buildLikert(51, 'P_J', 25),
      ...buildLikert(76, 'T_F', 25),
    ]
    const answered: Answers = {}
    SHORT_QUESTIONS.forEach(q => { answered[q.id] = 'E' })

    const r = calculateScore(answered, stale)
    expect(r.dimTotals).toEqual({ E_I: 25, S_N: 25, T_F: 25, P_J: 25 })
    expect(r.dimScored).toEqual({ E_I: 10, S_N: 10, T_F: 10, P_J: 10 })
    // 阈值必须基于 10 题（±7），否则 -20 分也会落进中间档
    expect(r.thresholds).toEqual({ E_I: 7, S_N: 7, T_F: 7, P_J: 7 })
    expect(r.chars).toEqual({ E_I: 'I', S_N: 'N', T_F: 'F', P_J: 'P' })
    expect(r.typeCode).toBe('INFP')
  })

  it('只答了 3 题时，阈值按 3 题算（±2），不按题库总数算', () => {
    const Q = buildLikert(1, 'E_I', 25)
    const r = calculateScore({ 1: 'E', 2: 'E', 3: 'E' }, Q)
    expect(r.dimScored.E_I).toBe(3)
    expect(r.thresholds.E_I).toBe(2)
    expect(r.chars.E_I).toBe('I')
  })

  it('一题未答时阈值退化为 1，全中立仍是 ABCD（真正的中立）', () => {
    const r = calculateScore({}, SHORT_QUESTIONS)
    expect(r.dimScored).toEqual({ E_I: 0, S_N: 0, T_F: 0, P_J: 0 })
    expect(r.chars).toEqual({ E_I: 'A', S_N: 'B', T_F: 'C', P_J: 'D' })
    expect(r.typeCode).toBe('ABCD')
  })
})
