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
  <div class="option-list" role="radiogroup">
    <button
      v-for="opt in options"
      :key="opt.key"
      type="button"
      class="option-row"
      :class="{ 'option-row--selected': modelValue === opt.key, 'option-row--disabled': disabled }"
      role="radio"
      :aria-checked="modelValue === opt.key"
      :disabled="disabled"
      @click="onClick(opt.key)"
    >
      <span class="option-label">{{ opt.label }}</span>
      <span class="option-mark" aria-hidden="true">{{ modelValue === opt.key ? '●' : '○' }}</span>
    </button>
  </div>
</template>

<style scoped>
.option-list { width: 100%; border-top: 1px solid #1e1d1a; }
.option-row {
  display: grid;
  grid-template-columns: 1fr 20px;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 58px;
  padding: 12px 2px;
  border: 0;
  border-bottom: 1px solid #d2c8b8;
  border-radius: 0;
  background: transparent;
  color: #1e1d1a;
  text-align: left;
  transition: background .18s ease, padding .18s ease;
}
.option-row:hover { background: rgba(210, 200, 184, .22); padding-left: 10px; }
.option-row--selected { background: rgba(166, 61, 44, .07); padding-left: 10px; }
.option-row--disabled { opacity: .45; cursor: not-allowed; }
.option-label { font-size: 15px; line-height: 1.6; }
.option-mark { color: #a63d2c; font-size: 14px; text-align: right; }
</style>
