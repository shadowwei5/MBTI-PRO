import { describe, it, expect } from 'vitest'
import { calculateScore, type Answers, type QuestionMeta } from '../scoring.js'

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

// 新结构：四维各 25 题；T_F = 15 likert + 10 objective
const QUESTIONS: QuestionMeta[] = [
  ...buildLikert(1, 'E_I', 25),
  ...buildLikert(26, 'S_N', 25),
  ...buildLikert(51, 'P_J', 25),
  ...buildLikert(76, 'T_F', 15),
  ...buildObjective(91, 10, 'A'),
]

function fillAll(qs: QuestionMeta[], key: 'A' | 'B' | 'C' | 'D' | 'E'): Answers {
  return Object.fromEntries(qs.map(q => [q.id, key])) as Answers
}

describe('calculateScore - 三级分类边界（四维统一对称 ±17）', () => {
  it('全 A：四维全部走极端正向，typeCode = ENTJ', () => {
    const r = calculateScore(fillAll(QUESTIONS, 'A'), QUESTIONS)
    expect(r.scores.E_I).toBe(50)
    expect(r.scores.S_N).toBe(50)
    expect(r.scores.P_J).toBe(50)
    expect(r.scores.T_F_sub).toBe(30)  // 15 likert × 2
    expect(r.scores.T_F_obj).toBe(20)  // 10 客观全对 × 2
    expect(r.scores.T_F).toBe(50)
    expect(r.chars).toEqual({ E_I: 'E', S_N: 'N', T_F: 'T', P_J: 'J' })
    expect(r.typeCode).toBe('ENTJ')
  })

  it('全 E：四维全部走极端负向，typeCode = ISFP', () => {
    const r = calculateScore(fillAll(QUESTIONS, 'E'), QUESTIONS)
    expect(r.scores.E_I).toBe(-50)
    expect(r.scores.T_F).toBe(-50)
    expect(r.chars).toEqual({ E_I: 'I', S_N: 'S', T_F: 'F', P_J: 'P' })
    expect(r.typeCode).toBe('ISFP')
  })

  it('全 C：likert 全中立 + 客观全错，T_F=-20 → F', () => {
    const r = calculateScore(fillAll(QUESTIONS, 'C'), QUESTIONS)
    expect(r.scores.E_I).toBe(0)
    expect(r.scores.S_N).toBe(0)
    expect(r.scores.P_J).toBe(0)
    expect(r.scores.T_F_sub).toBe(0)
    expect(r.scores.T_F_obj).toBe(-20)   // 客观 C ≠ correct A，全错 × 10
    expect(r.scores.T_F).toBe(-20)
    expect(r.chars.E_I).toBe('A')
    expect(r.chars.S_N).toBe('B')
    expect(r.chars.P_J).toBe('D')
    expect(r.chars.T_F).toBe('F')         // -20 < -17 → F
  })

  it('客观题完全未作答：每题 0 分，T_F=0 → C', () => {
    const ans: Answers = {}
    QUESTIONS.filter(q => q.type === 'likert').forEach(q => { ans[q.id] = 'C' })
    const r = calculateScore(ans, QUESTIONS)
    expect(r.scores.T_F_obj).toBe(0)
    expect(r.scores.T_F).toBe(0)
    expect(r.chars.T_F).toBe('C')         // 0 在 [-17, +16] → C
    expect(r.dimAnswered.T_F).toBe(15)    // likert 都答了，objective 都没答
  })
})

describe('calculateScore - T_F 客观题计分规则', () => {
  const Q: QuestionMeta[] = buildObjective(1, 4, 'B')

  it('答对 +2', () => {
    const r = calculateScore({ 1: 'B', 2: 'B', 3: 'B', 4: 'B' }, Q)
    expect(r.scores.T_F_obj).toBe(8)
  })

  it('答错 -2', () => {
    const r = calculateScore({ 1: 'A', 2: 'A', 3: 'A', 4: 'A' }, Q)
    expect(r.scores.T_F_obj).toBe(-8)
  })

  it('未答且未超时 = 0', () => {
    const r = calculateScore({}, Q)
    expect(r.scores.T_F_obj).toBe(0)
    expect(r.dimAnswered.T_F).toBe(0)
    expect(r.dimTotals.T_F).toBe(4)
  })

  it('超时未答 = -2', () => {
    const r = calculateScore({}, Q, { 1: true, 3: true })
    // 题 1 超时未答 → -2, 题 2 未答未超时 → 0, 题 3 超时未答 → -2, 题 4 未答未超时 → 0
    expect(r.scores.T_F_obj).toBe(-4)
  })

  it('超时但已作答 → 按正常计分（超时不额外扣分）', () => {
    const r = calculateScore({ 1: 'B', 2: 'A' }, Q, { 1: true, 2: true })
    // 题 1 答对 +2, 题 2 答错 -2, 题 3/4 未答 0
    expect(r.scores.T_F_obj).toBe(0)
  })

  it('混合：2 对 + 1 错 + 1 未答 = 4 - 2 + 0 = 2', () => {
    const r = calculateScore({ 1: 'B', 2: 'B', 3: 'A' }, Q)
    expect(r.scores.T_F_obj).toBe(2)
    expect(r.dimAnswered.T_F).toBe(3)
  })
})

describe('calculateScore - T_F 对称三级阈值（F<-17 / C[-17,+16] / T>16）', () => {
  it('总分 = -18 → F', () => {
    // 1 道 likert D(-1) + 10 道客观全错(-20) = -21... 需要刚好 -18
    const Q: QuestionMeta[] = [
      ...buildLikert(1, 'T_F', 1),        // likert: id=1
      ...buildObjective(2, 9, 'A'),       // obj: id=2..10
    ]
    // 1 likert D=-1, 9 obj all wrong=-18 → total -19. 用 8 错=-16 → -17
    // 1 likert D=-1, 8 obj wrong=-16 → -17 (边界C)
    // 需要 -18: 1 likert E=-2, 8 obj wrong=-16 → -18 ✓
    const ans: Answers = { 1: 'E' }
    for (let i = 2; i <= 9; i++) ans[i] = 'B'  // wrong
    ans[10] = 'B'  // 9th wrong → but we have 9 obj, so id 2-10, all B
    const r = calculateScore(ans, Q)
    expect(r.scores.T_F).toBe(-20)  // -2 + (-2×9) = -20
    expect(r.chars.T_F).toBe('F')
  })

  it('总分 = -17 → C（边界）', () => {
    const Q: QuestionMeta[] = [
      ...buildLikert(1, 'T_F', 1),
      ...buildObjective(2, 8, 'A'),
    ]
    // 1 likert E=-2, 7 obj wrong=-14, 1 obj right=+2 → -14
    // need -17: 1 likert E=-2, 7 wrong=-14, 1未答=0 → -16...
    // 1 likert D=-1, 8 wrong=-16 → -17 ✓
    const ans: Answers = { 1: 'D' }
    for (let i = 2; i <= 9; i++) ans[i] = 'B'
    const r = calculateScore(ans, Q)
    expect(r.scores.T_F).toBe(-17)
    expect(r.chars.T_F).toBe('C')
  })

  it('总分 = 16 → C（边界）', () => {
    const Q: QuestionMeta[] = [
      ...buildLikert(1, 'T_F', 1),
      ...buildObjective(2, 7, 'A'),
    ]
    // 1 likert A=2, 7 obj all right=+14 → 16 ✓
    const ans: Answers = { 1: 'A' }
    for (let i = 2; i <= 8; i++) ans[i] = 'A'
    const r = calculateScore(ans, Q)
    expect(r.scores.T_F).toBe(16)
    expect(r.chars.T_F).toBe('C')
  })

  it('总分 = 17 → T', () => {
    const Q: QuestionMeta[] = [
      ...buildLikert(1, 'T_F', 1),
      ...buildObjective(2, 7, 'A'),
    ]
    // 1 likert A=2, 7 right=14, 1 B(+1) → 17
    const ans: Answers = { 1: 'A', 2: 'A', 3: 'A', 4: 'A', 5: 'A', 6: 'A', 7: 'A', 8: 'A' }
    // sub=2, obj 7题全对=14 → total 16. 再加一道likert B=+1 → 17
    const Q2: QuestionMeta[] = [
      ...buildLikert(1, 'T_F', 2),
      ...buildObjective(3, 7, 'A'),
    ]
    const ans2: Answers = { 1: 'A', 2: 'B' }
    for (let i = 3; i <= 9; i++) ans2[i] = 'A'
    const r = calculateScore(ans2, Q2)
    expect(r.scores.T_F).toBe(17)
    expect(r.chars.T_F).toBe('T')
  })
})

describe('calculateScore - 对称维度阈值（±17）', () => {
  it('E_I = 17 → E', () => {
    const Q = buildLikert(1, 'E_I', 25)
    const ans: Answers = {}
    for (let i = 0; i < 8; i++) ans[i + 1] = 'A'
    ans[9] = 'B'
    for (let i = 9; i < 25; i++) ans[i + 1] = 'C'
    const r = calculateScore(ans, Q)
    expect(r.scores.E_I).toBe(17)
    expect(r.chars.E_I).toBe('E')
  })

  it('E_I = 16 → A', () => {
    const Q = buildLikert(1, 'E_I', 25)
    const ans: Answers = {}
    for (let i = 0; i < 8; i++) ans[i + 1] = 'A'
    for (let i = 8; i < 25; i++) ans[i + 1] = 'C'
    const r = calculateScore(ans, Q)
    expect(r.scores.E_I).toBe(16)
    expect(r.chars.E_I).toBe('A')
  })

  it('E_I = -17 → A（< -17 才是 I）', () => {
    const Q = buildLikert(1, 'E_I', 25)
    const ans: Answers = {}
    for (let i = 0; i < 8; i++) ans[i + 1] = 'E'
    ans[9] = 'D'
    for (let i = 9; i < 25; i++) ans[i + 1] = 'C'
    const r = calculateScore(ans, Q)
    expect(r.scores.E_I).toBe(-17)
    expect(r.chars.E_I).toBe('A')
  })

  it('E_I = -18 → I', () => {
    const Q = buildLikert(1, 'E_I', 25)
    const ans: Answers = {}
    for (let i = 0; i < 9; i++) ans[i + 1] = 'E'
    for (let i = 9; i < 25; i++) ans[i + 1] = 'C'
    const r = calculateScore(ans, Q)
    expect(r.scores.E_I).toBe(-18)
    expect(r.chars.E_I).toBe('I')
  })
})

describe('calculateScore - 置信度', () => {
  it('全极端答案 → 置信度接近 1', () => {
    const r = calculateScore(fillAll(QUESTIONS, 'A'), QUESTIONS)
    expect(r.confidence).toBeGreaterThan(0.5)
    expect(r.confidence).toBeLessThanOrEqual(1)
  })

  it('全中立 → 四维均匀低置信度', () => {
    const justLikert: QuestionMeta[] = [
      ...buildLikert(1, 'E_I', 25),
      ...buildLikert(26, 'S_N', 25),
      ...buildLikert(51, 'P_J', 25),
      ...buildLikert(76, 'T_F', 15),
    ]
    const r = calculateScore(fillAll(justLikert, 'C'), justLikert)
    // 四维 = 0：到最近阈值距离 = min(16, 17) = 16，归一化 16/50 ≈ 0.32
    expect(r.confidence).toBeGreaterThan(0.2)
    expect(r.confidence).toBeLessThan(0.4)
  })
})

describe('calculateScore - dimAnswered/dimTotals 元数据', () => {
  it('正确统计每维题数与回答数', () => {
    const r = calculateScore(fillAll(QUESTIONS, 'A'), QUESTIONS)
    expect(r.dimTotals).toEqual({ E_I: 25, S_N: 25, T_F: 25, P_J: 25 })
    expect(r.dimAnswered).toEqual({ E_I: 25, S_N: 25, T_F: 25, P_J: 25 })
  })

  it('部分作答时 dimAnswered 反映实际填写', () => {
    const ans: Answers = { 1: 'A', 2: 'A', 26: 'C' }
    const r = calculateScore(ans, QUESTIONS)
    expect(r.dimAnswered.E_I).toBe(2)
    expect(r.dimAnswered.S_N).toBe(1)
    expect(r.dimAnswered.T_F).toBe(0)
    expect(r.dimAnswered.P_J).toBe(0)
  })
})
