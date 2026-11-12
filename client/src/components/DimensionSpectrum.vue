<script setup lang="ts">
const props = defineProps<{
  typeCode: string
  typeName: string
  scores: { E_I: number; S_N: number; T_F: number; P_J: number }
  chars: { E_I: string; S_N: string; T_F: string; P_J: string }
  dimTotals?: { E_I: number; S_N: number; T_F: number; P_J: number }
  dimAnswered?: { E_I: number; S_N: number; T_F: number; P_J: number }
}>()

const rows = [
  { key: 'E_I', index: '01', label: '能量来源', left: 'I 内向', mid: 'A 平衡', right: 'E 外向' },
  { key: 'S_N', index: '02', label: '认知方式', left: 'N 直觉', mid: 'B 均衡', right: 'S 实感' },
  { key: 'T_F', index: '03', label: '决策方式', left: 'F 情感', mid: 'C 复合', right: 'T 思考' },
  { key: 'P_J', index: '04', label: '生活态度', left: 'P 感知', mid: 'D 动态', right: 'J 判断' },
] as const

function normalizedScore(score: number, dimKey: string): number {
  const dimTotal = props.dimTotals?.[dimKey as keyof typeof props.dimTotals] ?? 0
  if (dimTotal <= 0) return 0
  return Math.round((score / (dimTotal * 2)) * 100)
}

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
  <div class="spectrum">
    <div v-for="row in rows" :key="row.key" class="spectrum-row">
      <div class="spectrum-meta">
        <span class="spectrum-index">{{ row.index }}</span>
        <span class="spectrum-label">{{ row.label }}</span>
        <span class="spectrum-char">{{ chars[row.key] }}</span>
      </div>

      <div class="spectrum-axis">
        <div class="spectrum-labels">
          <span>{{ row.left }}</span>
          <span>{{ row.mid }}</span>
          <span>{{ row.right }}</span>
        </div>
        <div class="spectrum-track">
          <span class="spectrum-mid" />
          <span class="spectrum-fill-left" />
          <span class="spectrum-fill-right" />
          <span
            class="spectrum-dot"
            :style="{ left: `${dotPosition(scores[row.key], row.key)}%` }"
          />
        </div>
      </div>

      <span class="spectrum-confidence">{{ confidence(row.key) }}</span>
    </div>
  </div>
</template>

<style scoped>
.spectrum {
  --ink: #1e1d1a;
  --muted: #6f685d;
  --rule: #d2c8b8;
  --accent: #a63d2c;
  border-top: 1px solid var(--ink);
}
.spectrum-row {
  display: grid;
  grid-template-columns: 130px 1fr 42px;
  align-items: center;
  gap: 24px;
  padding: 20px 0;
  border-bottom: 1px solid var(--rule);
}
.spectrum-meta { display: grid; grid-template-columns: 28px 1fr; align-items: baseline; column-gap: 8px; }
.spectrum-index { color: var(--accent); font-family: "DM Mono", "SF Mono", Consolas, "Roboto Mono", monospace; font-size: 10px; }
.spectrum-label { color: var(--muted); font-size: 12px; }
.spectrum-char {
  grid-column: 2;
  margin-top: 4px;
  color: var(--ink);
  font-family: "DM Mono", "SF Mono", Consolas, "Roboto Mono", monospace;
  font-size: 19px;
}
.spectrum-labels {
  display: flex;
  justify-content: space-between;
  margin-bottom: 9px;
  color: var(--muted);
  font-family: "DM Mono", "SF Mono", Consolas, "Roboto Mono", monospace;
  font-size: 9px;
  letter-spacing: .02em;
}
.spectrum-labels span:nth-child(2) { color: var(--accent); }
.spectrum-track {
  position: relative;
  height: 1px;
  background: var(--rule);
}
.spectrum-mid {
  position: absolute;
  top: -4px;
  left: 50%;
  width: 1px;
  height: 9px;
  background: var(--accent);
}
.spectrum-fill-left, .spectrum-fill-right {
  position: absolute;
  top: -1px;
  width: 1px;
  height: 3px;
  background: var(--rule);
}
.spectrum-fill-left { left: 33.333%; }
.spectrum-fill-right { right: 33.333%; }
.spectrum-dot {
  position: absolute;
  top: 50%;
  width: 11px;
  height: 11px;
  border: 2px solid var(--paper, #f2ede3);
  border-radius: 50%;
  background: var(--accent);
  transform: translate(-50%, -50%);
}
.spectrum-confidence {
  color: var(--muted);
  font-family: "DM Mono", "SF Mono", Consolas, "Roboto Mono", monospace;
  font-size: 9px;
  text-align: right;
}

@media (max-width: 640px) {
  .spectrum-row { grid-template-columns: 88px 1fr; gap: 14px; }
  .spectrum-confidence { display: none; }
  .spectrum-meta { grid-template-columns: 24px 1fr; }
  .spectrum-labels { font-size: 8px; }
}
</style>
