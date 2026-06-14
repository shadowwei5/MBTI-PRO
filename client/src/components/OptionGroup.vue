<script setup lang="ts">
const props = defineProps<{
  options: { key: string; label: string }[]
  modelValue: string | null
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

function onClick(key: string) {
  if (props.disabled) return
  emit('update:modelValue', key)
}
</script>

<template>
  <div class="flex flex-col gap-3 w-full max-w-lg">
    <button
      v-for="opt in options"
      :key="opt.key"
      class="group relative w-full text-left px-6 py-4 rounded-2xl border-2 transition-all duration-300"
      :class="disabled
        ? 'border-border bg-surface-alt/50 opacity-60 cursor-not-allowed'
        : modelValue === opt.key
          ? 'border-coral bg-coral/10 shadow-lg shadow-coral/10 cursor-pointer'
          : 'border-border bg-white/60 hover:border-warm-gray hover:bg-surface cursor-pointer'"
      :disabled="disabled"
      @click="onClick(opt.key)"
    >
      <div class="flex items-center gap-3">
        <span
          class="text-base transition-colors duration-300"
          :class="modelValue === opt.key ? 'text-charcoal font-semibold' : 'text-text-secondary'"
        >
          {{ opt.label }}
        </span>
        <span
          v-if="modelValue === opt.key"
          class="ml-auto w-5 h-5 rounded-full bg-coral flex items-center justify-center shrink-0 animate-scale-in"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6L5 9L10 3" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </span>
      </div>
    </button>
  </div>
</template>
