import { describe, expect, it } from 'vitest'
import { getCreateReferralEligibilityError } from '../referralEligibility.js'

describe('referral eligibility', () => {
  it('allows high-confidence completed records even if the current route type is stale', () => {
    expect(getCreateReferralEligibilityError({ typeCode: 'INTJ', confidence: 100 })).toBeNull()
  })

  it('returns Chinese guidance for low-confidence records', () => {
    expect(getCreateReferralEligibilityError({ typeCode: 'INTJ', confidence: 91 })).toContain('置信度低于 92%')
  })

  it('returns Chinese guidance when the test record cannot be found', () => {
    expect(getCreateReferralEligibilityError(null)).toContain('未找到本次测试记录')
  })
})
