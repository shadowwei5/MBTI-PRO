import { describe, expect, it } from 'vitest'
import { ADMIN_DIMENSION_LABELS, ADMIN_QUESTION_TYPE_LABELS, isValidQuestionTiming } from '../adminStats.js'

describe('admin stats helpers', () => {
  it('filters impossible per-question timing values', () => {
    expect(isValidQuestionTiming(8.5)).toBe(true)
    expect(isValidQuestionTiming(120)).toBe(true)
    expect(isValidQuestionTiming(120.1)).toBe(false)
    expect(isValidQuestionTiming(303.4)).toBe(false)
    expect(isValidQuestionTiming(0)).toBe(false)
    expect(isValidQuestionTiming(Number.NaN)).toBe(false)
  })

  it('provides Chinese labels for dashboard dimensions and question types', () => {
    expect(ADMIN_DIMENSION_LABELS.E_I).toBe('能量来源')
    expect(ADMIN_DIMENSION_LABELS.S_N).toBe('认知方式')
    expect(ADMIN_QUESTION_TYPE_LABELS.likert).toBe('主观选择题')
    expect(ADMIN_QUESTION_TYPE_LABELS.objective).toBe('客观推理题')
  })
})
