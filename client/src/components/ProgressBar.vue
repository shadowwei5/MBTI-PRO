<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  modelValue: number
  max: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

const barRef = ref<HTMLElement | null>(null)
const isDragging = ref(false)

function getIndex(clientX: number): number {
  if (!barRef.value) return props.modelValue
  const rect = barRef.value.getBoundingClientRect()
  const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  return Math.round(ratio * props.max)
}

function onMouseDown(e: MouseEvent) {
  isDragging.value = true
  emit('update:modelValue', getIndex(e.clientX))
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

function onMouseMove(e: MouseEvent) {
  if (!isDragging.value) return
  emit('update:modelValue', getIndex(e.clientX))
}

function onMouseUp() {
  isDragging.value = false
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
}

function onTouchStart(e: TouchEvent) {
  isDragging.value = true
  emit('update:modelValue', getIndex(e.touches[0].clientX))
  document.addEventListener('touchmove', onTouchMove, { passive: false })
  document.addEventListener('touchend', onTouchEnd)
}

function onTouchMove(e: TouchEvent) {
  if (!isDragging.value) return
  e.preventDefault()
  emit('update:modelValue', getIndex(e.touches[0].clientX))
}

function onTouchEnd() {
  isDragging.value = false
  document.removeEventListener('touchmove', onTouchMove)
  document.removeEventListener('touchend', onTouchEnd)
}

const pct = () => props.max > 0 ? Math.round((props.modelValue / props.max) * 100) : 0
</script>

<template>
  <div class="w-full flex items-center gap-3">
    <div
      ref="barRef"
      class="relative flex-1 h-4 bg-surface-alt rounded-full overflow-visible cursor-pointer select-none touch-none"
      @mousedown.prevent="onMouseDown"
      @touchstart.prevent="onTouchStart"
    >
      <!-- Filled track -->
      <div
        class="absolute left-0 top-0 h-full rounded-full transition-[width] duration-150 ease-out pointer-events-none"
        :style="{
          width: `${pct()}%`,
          background: 'linear-gradient(90deg, #D4A853, #E8816B)',
        }"
      />
      <!-- Draggable thumb -->
      <div
        class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-white border-2 border-coral shadow-md transition-[left] duration-150 ease-out pointer-events-none"
        :style="{ left: `${pct()}%` }"
      />
    </div>
    <span class="text-sm text-warm-gray font-mono whitespace-nowrap tabular-nums">
      {{ max > 0 ? modelValue + 1 : 0 }} / {{ max + 1 }}
    </span>
  </div>
</template>
