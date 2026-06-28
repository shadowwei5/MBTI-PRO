<script setup lang="ts">
import { ref, onUnmounted } from 'vue'

const props = defineProps<{ typeCode: string; typeName: string; typeColor: string }>()

const isUnlocked = ref(false)
const showQR = ref(false)
const qrUrl = ref('')
const qrLoading = ref(false)
const qrError = ref('')
const payStatus = ref<'idle' | 'loading' | 'paid' | 'error'>('idle')
let pollTimer: ReturnType<typeof setInterval> | null = null

async function payToUnlock() {
  qrLoading.value = true
  qrError.value = ''
  payStatus.value = 'loading'

  try {
    const API_BASE = import.meta.env.VITE_API_BASE || '/api'
    const res = await fetch(`${API_BASE}/payment/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ typeCode: props.typeCode, typeName: props.typeName }),
    })
    const json = await res.json()

    if (!json.success || json.error) {
      qrError.value = json.error || '支付服务暂不可用'
      payStatus.value = 'error'
      return
    }

    if (json.paid) {
      // 已支付过
      isUnlocked.value = true
      return
    }

    if (json.data?.qrUrl) {
      qrUrl.value = json.data.qrUrl
      showQR.value = true
      payStatus.value = 'idle'
      startPolling()
    } else {
      qrError.value = '获取支付二维码失败'
      payStatus.value = 'error'
    }
  } catch {
    qrError.value = '网络错误，请重试'
    payStatus.value = 'error'
  } finally {
    qrLoading.value = false
  }
}

function startPolling() {
  stopPolling()
  pollTimer = setInterval(async () => {
    try {
      const API_BASE = import.meta.env.VITE_API_BASE || '/api'
      const res = await fetch(`${API_BASE}/payment/check/${props.typeCode}`)
      const json = await res.json()
      if (json.paid) {
        payStatus.value = 'paid'
        stopPolling()
        setTimeout(() => {
          isUnlocked.value = true
        }, 800)
      }
    } catch { /* retry next poll */ }
  }, 2000)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

onUnmounted(() => stopPolling())


// 将 weixin:// 链接转成可扫描的二维码图片
function getQRImageUrl(data: string): string {
  // 使用免费 QR 码生成 API
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data)}`
}
</script>

<template>
  <div class="paywall-section" v-if="!isUnlocked">
    <div class="paywall-card" :style="{ borderColor: typeColor + '33' }">
      <div class="lock-icon">🔒</div>
      <h3 class="paywall-title">解锁深度人格报告</h3>
      <p class="paywall-desc">包含人格概览、四维日常画像、代表人物、核心优势、成长空间、四维深度解析</p>

      <div class="paywall-actions">
        <button
          class="btn-unlock"
          :style="{ background: typeColor }"
          :disabled="qrLoading"
          @click="payToUnlock"
        >
          <span v-if="qrLoading" class="spinner" />
          {{ qrLoading ? '生成中...' : '¥4.9 立即解锁' }}
        </button>
      </div>

      <!-- 二维码区域 -->
      <div v-if="showQR && qrUrl" class="qr-section">
        <p class="qr-hint">请使用<strong>微信</strong>扫描二维码支付</p>
        <div class="qr-code-wrap">
          <img
            :src="getQRImageUrl(qrUrl)"
            alt="支付二维码"
            class="qr-img"
          />
          <div v-if="payStatus === 'paid'" class="paid-overlay">
            <span class="paid-check">✅</span>
            <p>支付成功！</p>
          </div>
        </div>
        <p class="qr-price">¥4.90</p>
        <p class="qr-polling" v-if="payStatus === 'idle'">等待支付中...</p>
        <p class="qr-polling paid-text" v-if="payStatus === 'paid'">支付成功，正在解锁...</p>
      </div>

      <p v-if="qrError" class="qr-error">{{ qrError }}</p>
    </div>
  </div>

  <div class="paywall-unlocked" v-else>
    <div class="unlocked-banner" :style="{ background: typeColor + '11', borderColor: typeColor + '33' }">
      ✅ 已解锁 · 完整深度报告
    </div>
    <slot />
  </div>
</template>

<style scoped>
.paywall-section { margin: 24px 0; }
.paywall-card {
  background: #FFF; border: 1.5px solid;
  border-radius: 20px; padding: 36px 28px; text-align: center;
}
.lock-icon { font-size: 40px; margin-bottom: 12px; }
.paywall-title { font-size: 22px; font-weight: 700; color: #2D2A26; margin-bottom: 8px; }
.paywall-desc { font-size: 15px; color: #6B6560; line-height: 1.5; margin-bottom: 24px; }
.paywall-actions { display: flex; flex-direction: column; gap: 12px; align-items: center; }
.btn-unlock {
  color: #FFF; border: none; border-radius: 14px; padding: 14px 40px;
  font-size: 18px; font-weight: 700; cursor: pointer; transition: transform .15s;
  display: flex; align-items: center; gap: 8px;
}
.btn-unlock:hover:not(:disabled) { transform: scale(1.03); }
.btn-unlock:disabled { opacity: 0.7; cursor: not-allowed; }

.qr-section { margin-top: 24px; }
.qr-hint { font-size: 14px; color: #6B6560; margin-bottom: 16px; }
.qr-code-wrap {
  display: inline-block; position: relative;
  border: 2px solid #E0D8CC; border-radius: 16px; padding: 12px;
  background: #FFF;
}
.qr-img { display: block; width: 200px; height: 200px; }
.paid-overlay {
  position: absolute; inset: 0;
  background: rgba(45, 138, 78, 0.92); border-radius: 14px;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  color: #FFF; font-size: 18px; font-weight: 700;
}
.paid-check { font-size: 40px; margin-bottom: 4px; }
.qr-price { font-size: 20px; font-weight: 700; color: #2D2A26; margin-top: 8px; }
.qr-polling { font-size: 13px; color: #9C958E; margin-top: 4px; }
.paid-text { color: #2D8A4E; font-weight: 600; }

.qr-error {
  margin-top: 16px; font-size: 14px; color: #E8816B;
}

.paywall-unlocked { margin: 16px 0; }
.unlocked-banner {
  border: 1.5px solid; border-radius: 12px; padding: 12px 20px;
  text-align: center; font-size: 15px; font-weight: 600; color: #2D2A26; margin-bottom: 16px;
}

.spinner {
  width: 16px; height: 16px;
  border: 2px solid rgba(255,255,255,0.3); border-top-color: #FFF;
  border-radius: 50%; animation: spin 0.6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
