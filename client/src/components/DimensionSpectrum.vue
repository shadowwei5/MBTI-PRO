<script setup lang="ts">
const props = defineProps<{
  typeCode: string
  typeName: string
  scores: { E_I: number; S_N: number; T_F: number; P_J: number }
  chars: { E_I: string; S_N: string; T_F: string; P_J: string }
  dimTotals?: { E_I: number; S_N: number; T_F: number; P_J: number }
  dimAnswered?: { E_I: number; S_N: number; T_F: number; P_J: number }
}>()

function normalizedScore(score: number, dimKey: string): number {
  const dimTotal = props.dimTotals?.[dimKey as keyof typeof props.dimTotals] ?? 0
  if (dimTotal <= 0) return 0

  const maxScore = dimTotal * 2
  return Math.round((score / maxScore) * 100)
}

// Dot position strictly proportional to normalized score (-100..+100) → (3%..97%)
function dotPosition(score: number, dimKey: string): number {
  const norm = normalizedScore(score, dimKey)
  return 3 + ((norm + 100) / 200) * 94
}

function confidence(dimKey: string): string {
  if (!props.dimAnswered || !props.dimTotals) return ''
  const a = props.dimAnswered[dimKey as keyof typeof props.dimAnswered] ?? 0
  const t = props.dimTotals[dimKey as keyof typeof props.dimTotals] ?? 0
  if (t === 0) return ''
  return `${Math.round((a / t) * 100)}%`
}
</script>

<template>
  <div class="w-full max-w-md mx-auto">
    <div class="flex flex-col gap-5">
      <div
        v-for="dim in [
          { key: 'E_I' as const, label: '能量来源', left: 'I 内向', mid: 'A 平衡', right: 'E 外向' },
          { key: 'S_N' as const, label: '认知方式', left: 'N 直觉', mid: 'B 均衡', right: 'S 实感' },
          { key: 'T_F' as const, label: '决策方式', left: 'F 情感', mid: 'C 复合', right: 'T 思考' },
          { key: 'P_J' as const, label: '生活态度', left: 'P 感知', mid: 'D 动态', right: 'J 判断' },
        ]"
        :key="dim.key"
      >
        <div class="flex justify-between text-xs text-text-muted mb-2 px-0.5">
          <span>{{ dim.left }}</span>
          <span class="font-medium text-text-secondary">{{ dim.mid }}</span>
          <span>{{ dim.right }}</span>
        </div>
        <div class="relative h-6 bg-surface-alt rounded-full overflow-visible mb-7">
          <!-- Center neutral zone -->
          <div class="absolute left-1/3 right-1/3 top-0 bottom-0 bg-sage/20 border-x-2 border-sage/30 rounded-full" />
          <!-- Score indicator dot with number inside -->
          <div
            class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex items-center justify-center transition-all duration-700 ease-out-expo w-8 h-8 rounded-full shadow-lg border-2 border-white"
            :style="{
              left: `${dotPosition(scores[dim.key], dim.key)}%`,
              background: ['#82B1FF','#B388FF','#40C4FF','#FFD740'][['E_I','S_N','T_F','P_J'].indexOf(dim.key)],
            }"
          >
            <span class="text-[10px] font-bold text-white leading-none tabular-nums drop-shadow-sm">
              {{ normalizedScore(scores[dim.key], dim.key) }}
            </span>
          </div>
        </div>
        <div class="flex items-center justify-center gap-2 mt-1">
          <span
            class="text-xs font-bold px-2 py-0.5 rounded-full"
            :class="{
              'bg-[#82B1FF]/15 text-[#5C8DFF]': dim.key === 'E_I',
              'bg-[#B388FF]/15 text-[#9C6FFF]': dim.key === 'S_N',
              'bg-[#40C4FF]/15 text-[#1DA8FF]': dim.key === 'T_F',
              'bg-[#FFD740]/15 text-[#E6B800]': dim.key === 'P_J',
            }"
          >
            {{ chars[dim.key] }}
          </span>
          <span
            v-if="confidence(dim.key)"
            class="text-[10px] text-text-muted"
          >
            置信度 {{ confidence(dim.key) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
