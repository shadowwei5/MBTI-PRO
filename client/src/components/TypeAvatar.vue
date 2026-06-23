<script setup lang="ts">
import { computed } from 'vue'
import { getTypeHex } from '../utils/colors'

const props = defineProps<{
  typeCode: string
  size?: number // default 48 for grid, larger for detail page
}>()

const size = computed(() => props.size ?? 48)
const hex = computed(() => getTypeHex(props.typeCode))

const chars = computed(() => ({
  ei: props.typeCode[0],
  sn: props.typeCode[1],
  tf: props.typeCode[2],
  pj: props.typeCode[3],
}))

// Deterministic seed from type code for subtle variations
const seed = computed(() => {
  let h = 0
  for (let i = 0; i < 4; i++) h = ((h << 5) - h) + props.typeCode.charCodeAt(i)
  return Math.abs(h)
})


// Primary geometric shape parameters
const primary = computed(() => {
  const { sn, tf, pj } = chars.value
  const s = size.value
  const cx = s / 2
  const cy = s / 2

  // Shape family determined by S_N × T_F
  const shapeType = sn === 'N'
    ? (tf === 'T' ? 'hexagon' : tf === 'C' ? 'ellipse' : 'circle')
    : sn === 'B'
    ? (tf === 'T' ? 'diamond' : tf === 'C' ? 'rounded-square' : 'circle')
    : (tf === 'T' ? 'square' : tf === 'C' ? 'rounded-square' : 'circle')

  // Size: N=larger(abstract), S=smaller(concrete), B=medium
  const baseSize = sn === 'N' ? s * 0.38 : sn === 'B' ? s * 0.32 : s * 0.28

  // Angularity from T_F
  const cornerR = tf === 'T' ? 0 : tf === 'C' ? s * 0.06 : s * 0.16

  // Rotation from P_J
  const rot = pj === 'J' ? 0 : pj === 'D' ? (seed.value % 15) : (seed.value % 30)

  return { shapeType, cx, cy, baseSize, cornerR, rot }
})

// Secondary elements (circles/dots) influenced by E_I
const secondary = computed(() => {
  const s = size.value
  const cx = s / 2
  const cy = s / 2
  const count = chars.value.ei === 'E' ? 3 : chars.value.ei === 'A' ? 2 : 1
  const dist = chars.value.ei === 'E' ? s * 0.35 : chars.value.ei === 'A' ? s * 0.28 : s * 0.18
  const r = s * 0.06

  const items: { x: number; y: number; r: number }[] = []
  for (let i = 0; i < count; i++) {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2 + (seed.value % 360) * (Math.PI / 180)
    items.push({
      x: cx + dist * Math.cos(angle),
      y: cy + dist * Math.sin(angle),
      r,
    })
  }
  return items
})

// Decorative accent lines from P_J
const accents = computed(() => {
  const s = size.value
  const cx = s / 2
  const cy = s / 2
  const count = chars.value.pj === 'J' ? 4 : chars.value.pj === 'D' ? 2 : 0
  if (!count) return []

  const items: { x1: number; y1: number; x2: number; y2: number }[] = []
  const inner = s * 0.22
  const outer = s * 0.42
  for (let i = 0; i < count; i++) {
    const angle = (2 * Math.PI * i) / count + (seed.value % 45) * (Math.PI / 180)
    items.push({
      x1: cx + inner * Math.cos(angle),
      y1: cy + inner * Math.sin(angle),
      x2: cx + outer * Math.cos(angle),
      y2: cy + outer * Math.sin(angle),
    })
  }
  return items
})

// SVG path for the primary shape
const shapePath = computed(() => {
  const { shapeType, cx, cy, baseSize, cornerR, rot } = primary.value
  const s = baseSize
  const transform = `rotate(${rot} ${cx} ${cy})`

  switch (shapeType) {
    case 'hexagon': {
      const pts: string[] = []
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6
        pts.push(`${cx + s * Math.cos(a)},${cy + s * Math.sin(a)}`)
      }
      return { d: `M${pts.join(' L')} Z`, transform }
    }
    case 'diamond': {
      const d = s * 1.15
      return {
        d: `M${cx} ${cy - d} L${cx + s} ${cy} L${cx} ${cy + d} L${cx - s} ${cy} Z`,
        transform,
      }
    }
    case 'square': {
      return {
        d: `M${cx - s} ${cy - s} L${cx + s} ${cy - s} L${cx + s} ${cy + s} L${cx - s} ${cy + s} Z`,
        transform,
      }
    }
    case 'rounded-square': {
      const r = cornerR
      return {
        d: `M${cx - s + r} ${cy - s} h${2 * s - 2 * r} a${r} ${r} 0 0 1 ${r} ${r} v${2 * s - 2 * r} a${r} ${r} 0 0 1 -${r} ${r} h${-(2 * s - 2 * r)} a${r} ${r} 0 0 1 -${r} -${r} v${-(2 * s - 2 * r)} a${r} ${r} 0 0 1 ${r} -${r} Z`,
        transform,
      }
    }
    case 'ellipse': {
      return { d: '', transform, isEllipse: true, rx: s * 1.2, ry: s * 0.7 }
    }
    case 'circle':
    default: {
      return { d: '', transform, isCircle: true, r: s }
    }
  }
})

// Inner detail pattern (I types get more inner complexity)
const innerDetail = computed(() => {
  if (chars.value.ei !== 'I') return null
  const s = size.value
  const cx = s / 2
  const cy = s / 2
  const r = s * 0.12
  // Small cross/dot in center for I types
  if (chars.value.sn === 'N') {
    // Small inner circle for abstract thinkers
    return { type: 'circle' as const, cx, cy, r }
  }
  // Small diamond for others
  const d = r * 0.8
  return {
    type: 'diamond' as const,
    points: `${cx},${cy - d} ${cx + d},${cy} ${cx},${cy + d} ${cx - d},${cy}`,
  }
})

const gradientId = computed(() => `avg-${props.typeCode}`)
const bgGradId = computed(() => `avbg-${props.typeCode}`)
</script>

<template>
  <svg
    :width="size"
    :height="size"
    :viewBox="`0 0 ${size} ${size}`"
    class="shrink-0 overflow-visible"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <radialGradient :id="gradientId" cx="50%" cy="50%" r="50%">
        <stop offset="0%" :stop-color="hex" :stop-opacity="0.35" />
        <stop offset="100%" :stop-color="hex" :stop-opacity="0.08" />
      </radialGradient>
      <radialGradient :id="bgGradId" cx="50%" cy="50%" r="60%">
        <stop offset="0%" :stop-color="hex" :stop-opacity="0.12" />
        <stop offset="100%" :stop-color="hex" :stop-opacity="0.02" />
      </radialGradient>
    </defs>

    <!-- Background glow circle -->
    <circle
      :cx="size / 2"
      :cy="size / 2"
      :r="size * 0.48"
      :fill="`url(#${bgGradId})`"
    />

    <!-- Subtle outer ring -->
    <circle
      :cx="size / 2"
      :cy="size / 2"
      :r="size * 0.46"
      fill="none"
      :stroke="hex"
      stroke-opacity="0.12"
      :stroke-width="size * 0.02"
    />

    <!-- Accent lines (J/D only) -->
    <line
      v-for="(a, i) in accents"
      :key="'a' + i"
      :x1="a.x1"
      :y1="a.y1"
      :x2="a.x2"
      :y2="a.y2"
      :stroke="hex"
      stroke-opacity="0.25"
      :stroke-width="size * 0.025"
      stroke-linecap="round"
    />

    <!-- Secondary orbiting elements -->
    <circle
      v-for="(s, i) in secondary"
      :key="'s' + i"
      :cx="s.x"
      :cy="s.y"
      :r="s.r"
      :fill="hex"
      :fill-opacity="chars.ei === 'E' ? 0.55 : 0.35"
    />

    <!-- Primary shape -->
    <ellipse
      v-if="shapePath.isEllipse"
      :cx="primary.cx"
      :cy="primary.cy"
      :rx="(shapePath as any).rx"
      :ry="(shapePath as any).ry"
      :fill="hex"
      fill-opacity="0.22"
      :stroke="hex"
      stroke-opacity="0.5"
      :stroke-width="size * 0.025"
      :transform="shapePath.transform"
    />
    <circle
      v-else-if="shapePath.isCircle"
      :cx="primary.cx"
      :cy="primary.cy"
      :r="(shapePath as any).r"
      :fill="hex"
      fill-opacity="0.22"
      :stroke="hex"
      stroke-opacity="0.5"
      :stroke-width="size * 0.025"
    />
    <path
      v-else
      :d="shapePath.d"
      :fill="hex"
      fill-opacity="0.22"
      :stroke="hex"
      stroke-opacity="0.5"
      :stroke-width="size * 0.025"
      :transform="shapePath.transform"
      stroke-linejoin="round"
    />

    <!-- Inner detail for I types -->
    <circle
      v-if="innerDetail?.type === 'circle'"
      :cx="(innerDetail as any).cx"
      :cy="(innerDetail as any).cy"
      :r="(innerDetail as any).r"
      :fill="hex"
      fill-opacity="0.45"
    />
    <polygon
      v-else-if="innerDetail?.type === 'diamond'"
      :points="(innerDetail as any).points"
      :fill="hex"
      fill-opacity="0.45"
    />

    <!-- Central dot -->
    <circle
      :cx="size / 2"
      :cy="size / 2"
      :r="size * 0.035"
      :fill="hex"
      fill-opacity="0.7"
    />
  </svg>
</template>
