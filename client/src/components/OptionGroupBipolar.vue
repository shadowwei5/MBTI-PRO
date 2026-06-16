<script setup lang="ts">
defineProps<{
  textLeft: string
  textRight: string
  modelValue: string | null
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()

const poleLeft = '#E8816B'
const poleRight = '#5C6BC0'
</script>

<template>
  <div class="w-full max-w-2xl mx-auto">
    <!-- Desktop: left-right three-column layout | Mobile: top-bottom stacked -->
    <div class="flex flex-col md:flex-row md:items-stretch gap-3 md:gap-4">

      <!-- Left / Top pole (E外向 / S实感 / T思考 / J判断) - Coral -->
      <div
        class="flex-1 flex flex-col rounded-2xl border-2 transition-all duration-300 overflow-hidden"
        :style="{
          borderColor: modelValue === 'A' || modelValue === 'B' ? poleLeft : '#E0D8CC',
          background: modelValue === 'A' || modelValue === 'B' ? poleLeft + '12' : '#ffffff99',
          boxShadow: modelValue === 'A' || modelValue === 'B' ? '0 4px 24px ' + poleLeft + '18' : 'none',
        }"
      >
        <!-- Statement -->
        <div class="p-4 md:p-5 pb-3">
          <p class="text-base md:text-lg font-semibold text-charcoal leading-relaxed">{{ textLeft }}</p>
        </div>
        <!-- Buttons -->
        <div class="flex gap-2 px-4 md:px-5 pb-4 md:pb-5 mt-auto">
          <button
            class="flex-1 px-3 py-3 rounded-xl text-sm font-semibold transition-all duration-300 cursor-pointer min-h-[44px]"
            :style="modelValue === 'A'
              ? { background: poleLeft, color: '#fff', boxShadow: '0 2px 12px ' + poleLeft + '40' }
              : { background: poleLeft + '18', color: poleLeft, border: '1.5px solid ' + poleLeft + '40' }"
            @click="$emit('update:modelValue', 'A')"
          >
            非常认同
          </button>
          <button
            class="flex-1 px-3 py-3 rounded-xl text-sm font-semibold transition-all duration-300 cursor-pointer min-h-[44px]"
            :style="modelValue === 'B'
              ? { background: poleLeft, color: '#fff', boxShadow: '0 2px 12px ' + poleLeft + '40' }
              : { background: poleLeft + '18', color: poleLeft, border: '1.5px solid ' + poleLeft + '40' }"
            @click="$emit('update:modelValue', 'B')"
          >
            认同
          </button>
        </div>
      </div>

      <!-- Neutral column -->
      <div class="flex md:flex-col items-center justify-center py-2 md:py-0 shrink-0">
        <button
          class="px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-300 cursor-pointer border-2 whitespace-nowrap min-h-[44px]"
          :style="modelValue === 'C'
            ? { background: '#8A827C', color: '#fff', borderColor: '#8A827C', boxShadow: '0 2px 12px rgba(138,130,124,0.3)' }
            : { background: '#ffffff99', color: '#9C958E', borderColor: '#E0D8CC' }"
          @click="$emit('update:modelValue', 'C')"
        >
          中立
        </button>
      </div>

      <!-- Right / Bottom pole (I内向 / N直觉 / F情感 / P感知) - Indigo -->
      <div
        class="flex-1 flex flex-col rounded-2xl border-2 transition-all duration-300 overflow-hidden"
        :style="{
          borderColor: modelValue === 'D' || modelValue === 'E' ? poleRight : '#E0D8CC',
          background: modelValue === 'D' || modelValue === 'E' ? poleRight + '12' : '#ffffff99',
          boxShadow: modelValue === 'D' || modelValue === 'E' ? '0 4px 24px ' + poleRight + '18' : 'none',
        }"
      >
        <!-- Statement -->
        <div class="p-4 md:p-5 pb-3">
          <p class="text-base md:text-lg font-semibold text-charcoal leading-relaxed">{{ textRight }}</p>
        </div>
        <!-- Buttons -->
        <div class="flex gap-2 px-4 md:px-5 pb-4 md:pb-5 mt-auto">
          <button
            class="flex-1 px-3 py-3 rounded-xl text-sm font-semibold transition-all duration-300 cursor-pointer min-h-[44px]"
            :style="modelValue === 'D'
              ? { background: poleRight, color: '#fff', boxShadow: '0 2px 12px ' + poleRight + '40' }
              : { background: poleRight + '18', color: poleRight, border: '1.5px solid ' + poleRight + '40' }"
            @click="$emit('update:modelValue', 'D')"
          >
            认同
          </button>
          <button
            class="flex-1 px-3 py-3 rounded-xl text-sm font-semibold transition-all duration-300 cursor-pointer min-h-[44px]"
            :style="modelValue === 'E'
              ? { background: poleRight, color: '#fff', boxShadow: '0 2px 12px ' + poleRight + '40' }
              : { background: poleRight + '18', color: poleRight, border: '1.5px solid ' + poleRight + '40' }"
            @click="$emit('update:modelValue', 'E')"
          >
            非常认同
          </button>
        </div>
      </div>

    </div>
  </div>
</template>
