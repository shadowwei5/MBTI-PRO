<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from 'vue'
import QRCode from 'qrcode'
import { api } from '../services/api'

defineProps<{ typeColor: string }>()

const amounts = [1, 5, 10, 20, 50]
const selectedAmount = ref<number | null>(5)
const customAmount = ref<string>('')
const activeTab = ref<'alipay' | 'wechat'>('alipay')

const loading = ref(false)
const qrDataUrl = ref<string | null>(null)
const aoid = ref<string | null>(null)
const paid = ref(false)
const errorMsg = ref<string | null>(null)
const polling = ref(false)

let timer: ReturnType<typeof setInterval> | null = null

const payType = computed<'alipay' | 'native'>(() => (activeTab.value === 'alipay' ? 'alipay' : 'native'))

const tabLabel = computed(() => (activeTab.value === 'alipay' ? '支付宝' : '微信'))

const finalAmount = computed<number | null>(() => {
  if (selectedAmount.value !== null) return selectedAmount.value
  const v = parseFloat(customAmount.value)
  return Number.isFinite(v) && v > 0 ? v : null
})

const displayAmount = computed(() => (finalAmount.value !== null ? finalAmount.value.toFixed(2) : ''))

const canGenerate = computed(
  () => !loading.value && finalAmount.value !== null && finalAmount.value >= 0.01 && finalAmount.value <= 500,
)

function clearTimer() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  polling.value = false
}

function resetQr() {
  clearTimer()
  qrDataUrl.value = null
  aoid.value = null
  paid.value = false
  errorMsg.value = null
}

function selectAmount(a: number | null) {
  selectedAmount.value = a
  if (a !== null) customAmount.value = ''
  resetQr()
}

function onCustomInput() {
  selectedAmount.value = null
  resetQr()
}

function switchTab(tab: 'alipay' | 'wechat') {
  if (activeTab.value === tab) return
  activeTab.value = tab
  resetQr()
}

async function generateQr() {
  if (!canGenerate.value) return
  resetQr()
  loading.value = true
  try {
    const data = await api.createDonation(finalAmount.value as number, payType.value)
    if (data.paid) {
      paid.value = true
      return
    }
    if (!data.qrUrl || !data.aoid) {
      errorMsg.value = '未获取到收款码，请重试'
      return
    }
    aoid.value = data.aoid
    const url = await QRCode.toDataURL(data.qrUrl, {
      width: 320,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
    })
    qrDataUrl.value = url
    startPolling()
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : '生成收款码失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

function startPolling() {
  clearTimer()
  polling.value = true
  timer = setInterval(async () => {
    if (!aoid.value) return
    try {
      const data = await api.checkDonation(aoid.value)
      if (data.paid) {
        paid.value = true
        clearTimer()
      } else if (data.status === 'expire') {
        errorMsg.value = '收款码已过期，请重新生成'
        clearTimer()
        qrDataUrl.value = null
      }
    } catch {
      // 忽略轮询瞬时错误，继续等待
    }
  }, 3000)
}

onBeforeUnmount(() => clearTimer())
</script>

<template>
  <div class="mt-10">
    <div class="bg-white/70 backdrop-blur-sm rounded-3xl p-6 md:p-8 border border-border shadow-sm text-center">
      <div
        class="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3"
        :style="{ background: typeColor + '1A' }"
      >
        <span class="text-2xl">☕</span>
      </div>
      <h2 class="text-lg font-display font-bold text-charcoal mb-1">请作者喝杯咖啡</h2>
      <p class="text-sm text-text-secondary mb-5">如果这个测试对你有帮助，欢迎打赏支持作者持续更新～</p>

      <!-- 支付成功 -->
      <div v-if="paid" class="py-6">
        <div class="text-4xl mb-3">❤️</div>
        <p class="text-base font-semibold text-charcoal">感谢你的打赏！</p>
        <p class="text-sm text-text-secondary mt-1">你的支持是我持续优化的动力～</p>
        <button
          type="button"
          @click="resetQr"
          class="mt-4 text-sm text-text-muted underline hover:text-coral transition"
        >再打赏一次</button>
      </div>

      <template v-else>
        <!-- 金额选择 -->
        <div class="flex flex-wrap justify-center gap-2 mb-4">
          <button
            v-for="a in amounts"
            :key="a"
            type="button"
            @click="selectAmount(a)"
            class="px-4 py-2 rounded-xl text-sm font-semibold border transition-all duration-200"
            :class="selectedAmount === a ? 'text-white border-transparent shadow' : 'bg-white/60 text-text-secondary border-border hover:border-coral'"
            :style="selectedAmount === a ? { background: typeColor, borderColor: typeColor } : {}"
          >
            ¥{{ a }}
          </button>
          <button
            type="button"
            @click="selectAmount(null)"
            class="px-4 py-2 rounded-xl text-sm font-semibold border transition-all duration-200"
            :class="selectedAmount === null ? 'text-white border-transparent shadow' : 'bg-white/60 text-text-secondary border-border hover:border-coral'"
            :style="selectedAmount === null ? { background: typeColor, borderColor: typeColor } : {}"
          >
            随心
          </button>
        </div>

        <!-- 自定义金额输入 -->
        <div v-if="selectedAmount === null" class="flex justify-center mb-4">
          <div class="relative">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">¥</span>
            <input
              v-model="customAmount"
              type="number"
              min="0.01"
              max="500"
              step="0.01"
              placeholder="0.01 - 500"
              @input="onCustomInput"
              class="w-44 pl-7 pr-3 py-2 rounded-xl text-sm border border-border bg-white/70 focus:outline-none focus:border-coral text-center"
            />
          </div>
        </div>

        <!-- 支付方式 -->
        <div class="inline-flex p-1 bg-surface rounded-xl mb-5 border border-border/60">
          <button
            type="button"
            @click="switchTab('alipay')"
            class="px-5 py-1.5 rounded-lg text-sm font-semibold transition"
            :class="activeTab === 'alipay' ? 'bg-white text-charcoal shadow-sm' : 'text-text-muted'"
          >支付宝</button>
          <button
            type="button"
            @click="switchTab('wechat')"
            class="px-5 py-1.5 rounded-lg text-sm font-semibold transition"
            :class="activeTab === 'wechat' ? 'bg-white text-charcoal shadow-sm' : 'text-text-muted'"
          >微信</button>
        </div>

        <!-- 错误提示 -->
        <p v-if="errorMsg" class="text-sm text-coral mb-4">{{ errorMsg }}</p>

        <!-- 收款码 -->
        <div v-if="qrDataUrl" class="flex flex-col items-center">
          <div class="w-48 h-48 rounded-2xl bg-white p-3 border border-border shadow-sm">
            <img :src="qrDataUrl" :alt="tabLabel + '打赏二维码'" class="w-full h-full object-contain" />
          </div>
          <p class="text-sm font-semibold text-charcoal mt-3">请使用{{ tabLabel }}扫码打赏 ¥{{ displayAmount }}</p>
          <p class="text-xs text-text-muted mt-1 flex items-center gap-1">
            <span class="inline-block w-2 h-2 rounded-full animate-pulse" :style="{ background: typeColor }"></span>
            正在等待支付结果…
          </p>
          <button
            type="button"
            @click="resetQr"
            class="mt-3 text-sm text-text-muted underline hover:text-coral transition"
          >重新选择金额</button>
        </div>

        <!-- 生成按钮 -->
        <div v-else class="flex flex-col items-center">
          <button
            type="button"
            :disabled="!canGenerate"
            @click="generateQr"
            class="px-8 py-3 rounded-2xl text-sm font-semibold text-white shadow transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:-translate-y-0.5 hover:shadow-lg"
            :style="{ background: typeColor }"
          >
            <span v-if="loading">生成中…</span>
            <span v-else>生成收款码</span>
          </button>
          <p class="text-xs text-text-muted mt-3 leading-relaxed">
            点击后生成{{ tabLabel }}收款码，扫码后可在{{ tabLabel }}内确认打赏金额
          </p>
        </div>
      </template>
    </div>
  </div>
</template>