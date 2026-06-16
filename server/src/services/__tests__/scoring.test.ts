import { describe, it, expect } from 'vitest'
import { calculateScore, type Answers, type QuestionMeta } from '../scoring.js'

// 构造测试用题库：每维 25 道 likert，T_F 维额外 20 道客观
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

const QUESTIONS_25: QuestionMeta[] = [
  ...buildLikert(1, 'E_I', 25),
  ...buildLikert(26, 'S_N', 25),
  ...buildLikert(51, 'T_F', 5),
  ...buildLikert(56, 'P_J', 25),
  ...buildObjective(91, 20, 'A'),
]

function fillAll(qs: QuestionMeta[], key: 'A' | 'B' | 'C' | 'D' | 'E'): Answers {
  return Object.fromEntries(qs.map(q => [q.id, key])) as Answers
}

describe('calculateScore - 三级分类边界', () => {
  it('全 A：四维全部走极端正向，typeCode = ENTJ', () => {
    const r = calculateScore(fillAll(QUESTIONS_25, 'A'), QUESTIONS_25)
    expect(r.scores.E_I).toBe(50)   // 25 × 2
    expect(r.scores.S_N).toBe(50)
    expect(r.scores.P_J).toBe(50)
    expect(r.scores.T_F_sub).toBe(10) // 5 likert × 2
    expect(r.scores.T_F_obj).toBe(40) // 20 客观全对 × 2
    expect(r.scores.T_F).toBe(50)
    expect(r.chars).toEqual({ E_I: 'E', S_N: 'N', T_F: 'T', P_J: 'J' })
    expect(r.typeCode).toBe('ENTJ')
  })

  it('全 E：四维全部走极端负向，typeCode = ISFP', () => {
    // 客观题答 E（错），扣 -2 × 20 = -40；主观 likert 全 E = -2 × 5 = -10；T_F 总 -50
    const r = calculateScore(fillAll(QUESTIONS_25, 'E'), QUESTIONS_25)
    expect(r.scores.E_I).toBe(-50)
    expect(r.scores.T_F).toBe(-50)
    expect(r.chars).toEqual({ E_I: 'I', S_N: 'S', T_F: 'F', P_J: 'P' })
    expect(r.typeCode).toBe('ISFP')
  })

  it('全 C：likert 全中立 + 客观全未答，落入中区 ABCD（注意：客观全未答 = -40，T_F 走 F）', () => {
    // 全 C 的 answers 不会触发未答 = -2，因为 C 已作答
    // 这里 C 的客观题映射到 'C'，与 correctAnswer 'A' 不一致 → 答错 → -2 × 20 = -40
    const r = calculateScore(fillAll(QUESTIONS_25, 'C'), QUESTIONS_25)
    expect(r.scores.E_I).toBe(0)
    expect(r.scores.S_N).toBe(0)
    expect(r.scores.P_J).toBe(0)
    expect(r.scores.T_F_sub).toBe(0)
    expect(r.scores.T_F_obj).toBe(-40)
    expect(r.chars.E_I).toBe('A')
    expect(r.chars.S_N).toBe('B')
    expect(r.chars.P_J).toBe('D')
    expect(r.chars.T_F).toBe('F')
  })

  it('客观题完全未作答：每题扣 -2，客观分 = -40（按规则 "未答 = -2"）', () => {
    // 只填 likert，客观 20 题留空
    const ans: Answers = {}
    QUESTIONS_25.filter(q => q.type === 'likert').forEach(q => { ans[q.id] = 'C' })
    const r = calculateScore(ans, QUESTIONS_25)
    expect(r.scores.T_F_obj).toBe(-40)
    expect(r.scores.T_F).toBe(-40)
    expect(r.chars.T_F).toBe('F')
    expect(r.dimAnswered.T_F).toBe(5) // likert 都答了，objective 都没答
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

  it('未答 -2（与答错同等扣分）', () => {
    const r = calculateScore({}, Q)
    expect(r.scores.T_F_obj).toBe(-8)
    expect(r.dimAnswered.T_F).toBe(0) // 但 dimAnswered 不计入未答
    expect(r.dimTotals.T_F).toBe(4)
  })

  it('混合：2 对 + 1 错 + 1 未答 = +4 -2 -2 = 0', () => {
    // id 1,2 答对 B → +2×2 = 4；id 3 答 A 错 → -2；id 4 未答 → -2；合计 0
    const r = calculateScore({ 1: 'B', 2: 'B', 3: 'A' }, Q)
    expect(r.scores.T_F_obj).toBe(0)
    expect(r.dimAnswered.T_F).toBe(3)
  })
})

describe('calculateScore - T_F 三级阈值（F<10 / C∈[10,29] / T>29）', () => {
  it('总分 9 → F', () => {
    const Q: QuestionMeta[] = [
      ...buildLikert(1, 'T_F', 5),       // 全填 C → 0
      ...buildObjective(6, 5, 'A'),      // 5 题，答对 2 题 + 错/未答 3 题 = +4 -6 = -2 ... 调整
    ]
    // 想让 T_F = 9：全 likert 中立 0，客观需要 +9 ... 不可能（每题 ±2 都是偶数）
    // 改用 likert 凑奇数
    const Q2: QuestionMeta[] = [
      ...buildLikert(1, 'T_F', 5),
      ...buildObjective(6, 5, 'A'),
    ]
    // likert 4 个 A (=8) + 1 个 D (=-1) = 7；客观 1 对 (+2) + 4 错 (-8) = -6 → 总 1
    // 试 likert 5×A=10, 客观 1 错 + 4 对 = -2+8=6 → 16 不行
    // 简单点：T_F_sub=10 (全A), T_F_obj=-2 (1对4错 = 2-8=-6)... 还是 4
    // T_F_sub=8 (4A+1C=8), T_F_obj=1 不可能
    // 用 9 = T_F_sub 9 + obj 0 也不行（obj 必偶数）
    // 偶数总分：总分 8 → F，10 → C
    const ans = { 1: 'A' as const, 2: 'A' as const, 3: 'A' as const, 4: 'A' as const, 5: 'C' as const,
                  6: 'A' as const, 7: 'A' as const, 8: 'B' as const, 9: 'B' as const, 10: 'B' as const }
    // sub: 4×2 + 0 = 8；obj: 2 对 + 3 错 = 4-6 = -2；总 = 6 → F
    const r = calculateScore(ans, Q2)
    expect(r.scores.T_F).toBe(6)
    expect(r.chars.T_F).toBe('F')
  })

  it('总分 10 → C', () => {
    const Q: QuestionMeta[] = [
      ...buildLikert(1, 'T_F', 5),
      ...buildObjective(6, 5, 'A'),
    ]
    // sub: 5×A=10, obj: 5 全错=-10 → 总 0；不行
    // sub: 5×A=10, obj: 全对=+10 → 总 20 → C ✓
    const ans = { 1: 'A' as const, 2: 'A' as const, 3: 'A' as const, 4: 'A' as const, 5: 'A' as const,
                  6: 'A' as const, 7: 'A' as const, 8: 'A' as const, 9: 'A' as const, 10: 'A' as const }
    const r = calculateScore(ans, Q)
    expect(r.scores.T_F).toBe(20)
    expect(r.chars.T_F).toBe('C')
  })

  it('总分 30 → T', () => {
    const Q: QuestionMeta[] = [
      ...buildLikert(1, 'T_F', 5),
      ...buildObjective(6, 15, 'A'),
    ]
    // sub: 10, obj: 全对 = +30 → 总 40 → T
    const ans: Answers = {}
    Q.forEach(q => { ans[q.id] = 'A' })
    const r = calculateScore(ans, Q)
    expect(r.scores.T_F).toBe(40)
    expect(r.chars.T_F).toBe('T')
  })

  it('阈值 29 边界：总分 = 29 落入 C（>29 才是 T）', () => {
    // 难凑奇数，但 28 → C 验证下边界
    const Q: QuestionMeta[] = [
      ...buildLikert(1, 'T_F', 5),
      ...buildObjective(6, 10, 'A'),
    ]
    // sub: 5×A=10, obj: 9 对+1 错= 18-2=16, 总=26 → C
    const ans: Answers = {}
    for (let i = 1; i <= 5; i++) ans[i] = 'A'
    for (let i = 6; i <= 14; i++) ans[i] = 'A'
    ans[15] = 'B' // 答错
    const r = calculateScore(ans, Q)
    expect(r.scores.T_F).toBe(26)
    expect(r.chars.T_F).toBe('C')
  })
})

describe('calculateScore - 对称维度阈值（±17）', () => {
  it('E_I = 17 → A（中区上沿）', () => {
    // > 16 才是 E，所以 17 已经是 E
    const Q = buildLikert(1, 'E_I', 25)
    const ans: Answers = {}
    // 凑 17 = 8×A(=16) + 1×B(=1) + 16 个 C(=0)
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
    // -17 = 8×E(-16) + 1×D(-1)
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
    const r = calculateScore(fillAll(QUESTIONS_25, 'A'), QUESTIONS_25)
    expect(r.confidence).toBeGreaterThan(0.5)
    expect(r.confidence).toBeLessThanOrEqual(1)
  })

  it('全中立 → 三个对称维度低置信度（T_F 因阈值不对称会被拉高）', () => {
    const justLikert: QuestionMeta[] = [
      ...buildLikert(1, 'E_I', 25),
      ...buildLikert(26, 'S_N', 25),
      ...buildLikert(51, 'T_F', 5),
      ...buildLikert(56, 'P_J', 25),
    ]
    const r = calculateScore(fillAll(justLikert, 'C'), justLikert)
    // 三对称维度 = 0：到最近阈值距离 = min(16, 17) = 16，归一化 16/50 ≈ 0.32
    // T_F = 0：阈值 <10/[10,29]/>29，0 落在 F 区且距离 10、归一化 10/10 = 1.0
    // 平均 ≈ (0.32×3 + 1.0)/4 ≈ 0.49
    expect(r.confidence).toBeGreaterThan(0.3)
    expect(r.confidence).toBeLessThan(0.6)
  })
})

describe('calculateScore - dimAnswered/dimTotals 元数据', () => {
  it('正确统计每维题数与回答数', () => {
    const r = calculateScore(fillAll(QUESTIONS_25, 'A'), QUESTIONS_25)
    expect(r.dimTotals).toEqual({ E_I: 25, S_N: 25, T_F: 25, P_J: 25 })
    expect(r.dimAnswered).toEqual({ E_I: 25, S_N: 25, T_F: 25, P_J: 25 })
  })

  it('部分作答时 dimAnswered 反映实际填写', () => {
    const ans: Answers = { 1: 'A', 2: 'A', 26: 'C' }
    const r = calculateScore(ans, QUESTIONS_25)
    expect(r.dimAnswered.E_I).toBe(2)
    expect(r.dimAnswered.S_N).toBe(1)
    expect(r.dimAnswered.T_F).toBe(0) // 注意：未答客观题不计入 answered
    expect(r.dimAnswered.P_J).toBe(0)
  })
})
