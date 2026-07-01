import { describe, expect, it } from 'vitest'
import { scalePopulationFor81 } from '../population.js'

describe('scalePopulationFor81', () => {
  it('scales single traditional 16-type percentages to 81-type estimates', () => {
    expect(scalePopulationFor81('约 2.1%')).toBe('约 0.4%')
    expect(scalePopulationFor81('约 13.8%')).toBe('约 2.7%')
  })

  it('scales percentage ranges', () => {
    expect(scalePopulationFor81('约 2-5%')).toBe('约 0.4-1%')
    expect(scalePopulationFor81('约 0.3-1.0%')).toBe('约 0.06-0.2%')
  })
})
