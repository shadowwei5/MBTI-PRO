<script setup lang="ts">
import { ref } from 'vue'
import { IS_DEMO } from '../services/demoMode'
import { redeemAccessCode, setAccessToken } from '../services/access'

defineProps<{
  compact?: boolean
  title?: string
  description?: string
}>()

const emit = defineEmits<{ unlocked: [token: string] }>()

const code = ref('')
const loading = ref(false)
const error = ref('')

async function submit() {
  if (loading.value) return
  error.value = ''
  loading.value = true
  try {
    if (IS_DEMO) {
      setAccessToken('demo-access')
      emit('unlocked', 'demo-access')
      return
    }
    const token = await redeemAccessCode(code.value)
    emit('unlocked', token)
  } catch (err) {
    error.value = err instanceof Error ? err.message : '兑换失败，请稍后重试。'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="access-gate" :class="compact ? 'access-gate--compact' : ''">
    <div class="access-gate__icon">81</div>
    <h3 class="access-gate__title">{{ title || '输入兑换码，解锁全部内容' }}</h3>
    <p class="access-gate__desc">
      {{ description || '在小红书店铺购买 0.99 元商品后，复制订单里的兑换码。一次兑换，40 题测试与完整报告全部解锁。' }}
    </p>

    <form class="access-gate__form" @submit.prevent="submit">
      <input
        v-model="code"
        type="text"
        inputmode="text"
        autocomplete="one-time-code"
        spellcheck="false"
        placeholder="例如 MBTI-ABCD-EFGH-JKLM"
        class="access-gate__input"
        :disabled="loading"
      />
      <button type="submit" class="access-gate__button" :disabled="loading || (!IS_DEMO && !code.trim())">
        {{ loading ? '兑换中…' : (IS_DEMO ? '演示环境直接开始' : '兑换并开始测试') }}
      </button>
    </form>

    <p v-if="error" class="access-gate__error">{{ error }}</p>
    <p class="access-gate__hint">兑换码仅用于本机解锁；如果更换设备，请重新输入同一兑换码。</p>
  </div>
</template>

<style scoped>
.access-gate {
  width: 100%;
  max-width: 560px;
  margin: 0 auto;
  padding: 34px 30px 28px;
  background: #f8f4ec;
  border: 1px solid #1e1d1a;
  border-radius: 2px;
  box-shadow: none;
  text-align: left;
}
.access-gate--compact { padding: 26px 22px 22px; }
.access-gate__icon {
  width: 38px; height: 38px; margin: 0 0 18px;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid #a63d2c; background: transparent; color: #a63d2c;
  font-family: "DM Mono", "SF Mono", Consolas, "Roboto Mono", monospace;
  font-weight: 500; font-size: 14px; letter-spacing: .02em;
}
.access-gate__title {
  font-family: "Playfair Display", "Songti SC", "STSong", SimSun, "Noto Serif CJK SC", "Source Han Serif SC", serif;
  font-size: 24px; font-weight: 600; color: #1e1d1a;
  margin: 0 0 10px; letter-spacing: -.03em;
}
.access-gate__desc { font-size: 13px; line-height: 1.85; color: #6f685d; margin: 0 0 20px; }
.access-gate__form { display: flex; flex-direction: column; gap: 10px; }
.access-gate__input {
  width: 100%; padding: 13px 14px; border: 1px solid #d2c8b8; border-radius: 0;
  background: #f2ede3; color: #1e1d1a; font-size: 14px; text-align: left;
  font-family: "DM Mono", "SF Mono", Consolas, "Roboto Mono", monospace; letter-spacing: .08em; outline: none;
}
.access-gate__input:focus { border-color: #a63d2c; }
.access-gate__button {
  width: 100%; padding: 14px 18px; border: 1px solid #1e1d1a; border-radius: 0;
  background: #1e1d1a; color: #f8f4ec; font-size: 14px; font-weight: 600; cursor: pointer;
}
.access-gate__button:hover:not(:disabled) { background: #a63d2c; border-color: #a63d2c; }
.access-gate__button:disabled { opacity: .45; cursor: not-allowed; }
.access-gate__error { margin: 12px 0 0; font-size: 12px; color: #a63d2c; }
.access-gate__hint { margin: 12px 0 0; font-size: 11px; line-height: 1.7; color: #8b8275; }
</style>
