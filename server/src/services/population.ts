const POPULATION_SCALE = 16 / 81

function formatScaledPercent(value: number): string {
  const scaled = value * POPULATION_SCALE
  if (scaled < 0.1 && scaled > 0) return scaled.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
  return scaled.toFixed(1).replace(/\.0$/, '')
}

export function scalePopulationFor81(population?: string | null): string | null {
  if (!population) return population ?? null
  const ranges: string[] = []
  const withRangePlaceholders = population.replace(/(\d+(?:\.\d+)?)(\s*-\s*)(\d+(?:\.\d+)?)%/g, (_match, low, separator, high) => {
    const replacement = `${formatScaledPercent(Number(low))}${separator}${formatScaledPercent(Number(high))}%`
    ranges.push(replacement)
    return `__MBTI_POP_RANGE_${ranges.length - 1}__`
  })
  return withRangePlaceholders
    .replace(/(\d+(?:\.\d+)?)%/g, (_match, value) => `${formatScaledPercent(Number(value))}%`)
    .replace(/__MBTI_POP_RANGE_(\d+)__/g, (_match, index) => ranges[Number(index)] || '')
}