<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { api } from '../services/api'

const props = defineProps<{ typeCode: string; typeName: string; typeColor: string; recordId?: string }>()
const emit = defineEmits<{ unlocked: [unlockToken: string] }>()

const STORAGE_KEY = 'mbti-pro-orders'

// 恢复解锁状态
const isUnlocked = ref(false)
const unlockToken = ref('')
const unlockedOrders = ref<Record<string, string>>(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'))

onMounted(() => {
  const savedToken = unlockedOrders.value[props.typeCode]
  if (savedToken) {
    unlockToken.value = savedToken
    verifySavedUnlock(savedToken)
  }
})

function persistUnlock(token: string) {
  unlockToken.value = token
  unlockedOrders.value[props.typeCode] = token
  localStorage.setItem(STORAGE_KEY, JSON.stringify(unlockedOrders.value))
}

function clearSavedUnlock() {
  delete unlockedOrders.value[props.typeCode]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(unlockedOrders.value))
}

// 解锁后自动滚动到内容区
watch(isUnlocked, async (val) => {
  if (val) {
    emit('unlocked', unlockToken.value)
    await nextTick()
    const el = document.querySelector('.paywall-unlocked')
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
})

const showQR = ref(false)
const qrUrl = ref('')
const qrLoading = ref(false)
const qrError = ref('')
const payStatus = ref<'idle' | 'loading' | 'paid' | 'error'>('idle')
const userEmail = ref('')
const emailSaved = ref(false)
const emailError = ref('')
const inviteLoading = ref(false)
const inviteError = ref('')
const inviteLink = ref('')
const inviteCopied = ref(false)
let pollTimer: ReturnType<typeof setInterval> | null = null

function isValidEmail(e: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) }

async function saveEmail() {
  if (!userEmail.value || !isValidEmail(userEmail.value)) {
    emailError.value = '请输入有效的邮箱地址'
    return false
  }
  try {
    await api.saveEmail(userEmail.value, props.typeCode, 'paywall')
    emailSaved.value = true
    emailError.value = ''
    return true
  } catch {
    emailError.value = '保存失败，请重试'
    return false
  }
}

async function payToUnlock() {
  emailError.value = ''
  if (!userEmail.value || !isValidEmail(userEmail.value)) {
    emailError.value = '请输入有效的邮箱地址，用于接收PDF报告'
    return
  }

  // 先保存邮箱
  if (!emailSaved.value) {
    const saved = await saveEmail()
    if (!saved) return
  }
  qrLoading.value = true
  qrError.value = ''
  payStatus.value = 'loading'

  try {
    const data = await api.createPayment(
      props.typeCode,
      props.typeName,
      userEmail.value || undefined,
      localStorage.getItem('mbti-pro-referral-code') || undefined,
      props.recordId || undefined,
    )

    if (data.paid) {
      persistUnlock(data.unlockToken)
      isUnlocked.value = true
      return
    }

    if (!data.qrUrl) throw new Error('获取支付二维码失败')

    qrUrl.value = data.qrUrl
    unlockToken.value = data.unlockToken
    showQR.value = true
    payStatus.value = 'idle'
    startPolling()
  } catch (err: any) {
    qrError.value = err.message || '网络错误，请重试'
    payStatus.value = 'error'
  } finally {
    qrLoading.value = false
  }
}

async function createInviteUnlock() {
  inviteError.value = ''
  inviteCopied.value = false
  if (!props.recordId) {
    inviteError.value = '请从完整测试结果页生成邀请链接'
    return
  }
  if (!userEmail.value || !isValidEmail(userEmail.value)) {
    emailError.value = '请输入有效的邮箱地址，用于接收免费解锁PDF报告'
    return
  }
  if (!emailSaved.value) {
    const saved = await saveEmail()
    if (!saved) return
  }
  inviteLoading.value = true
  try {
    const reward = await api.createReferral(props.recordId, props.typeCode, userEmail.value)
    localStorage.setItem('mbti-pro-referral-email', userEmail.value)
    inviteLink.value = `${window.location.origin}/test?ref=${reward.code}`
  } catch (err: any) {
    inviteError.value = err.message || '生成邀请链接失败，请稍后重试'
  } finally {
    inviteLoading.value = false
  }
}

async function copyInviteLink() {
  if (!inviteLink.value) return
  try {
    await navigator.clipboard.writeText(inviteLink.value)
    inviteCopied.value = true
  } catch {
    inviteCopied.value = false
  }
}

async function checkAndUnlock() {
  if (!unlockToken.value) return false
  try {
    const data = await api.checkPayment(props.typeCode, unlockToken.value)
    if (data.paid) {
      payStatus.value = 'paid'
      stopPolling()
      setTimeout(() => {
        persistUnlock(unlockToken.value)
        isUnlocked.value = true
      }, 800)
      return true
    }
  } catch { /* retry next poll */ }
  return false
}

function startPolling() {
  stopPolling()
  // 立即检查一次（不等2秒）
  checkAndUnlock()
  pollTimer = setInterval(() => {
    checkAndUnlock()
  }, 2000)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

// 页面可见性变化时立即检查（用户从支付宝切回浏览器时触发）
function onVisibilityChange() {
  if (document.visibilityState === 'visible' && pollTimer) {
    checkAndUnlock()
  }
}

onMounted(() => {
  document.addEventListener('visibilitychange', onVisibilityChange)
  // 也检查服务端状态（localStorage 可能过期）
  if (!isUnlocked.value && unlockToken.value) {
    api.checkPayment(props.typeCode, unlockToken.value).then(data => {
      if (data.paid) {
        persistUnlock(unlockToken.value)
        isUnlocked.value = true
      } else {
        clearSavedUnlock()
      }
    }).catch(() => {})
  }
})

async function verifySavedUnlock(token: string) {
  try {
    const data = await api.checkPayment(props.typeCode, token)
    if (data.paid) {
      persistUnlock(token)
      isUnlocked.value = true
    } else {
      clearSavedUnlock()
    }
  } catch { /* ignore */ }
}

onUnmounted(() => {
  stopPolling()
  document.removeEventListener('visibilitychange', onVisibilityChange)
})


// 将支付链接转成可扫描的二维码图片
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

      <!-- 邮箱收集 -->
      <div class="email-section">
        <div class="email-input-wrap">
          <input
            v-model="userEmail"
            type="email"
            placeholder="输入邮箱，解锁后发送完整报告PDF"
            class="email-input"
            :class="{ 'email-saved': emailSaved }"
            :disabled="emailSaved"
            @keyup.enter="payToUnlock"
          />
          <span v-if="emailSaved" class="email-check">✅</span>
        </div>
        <p v-if="emailError" class="email-error">{{ emailError }}</p>
        <p v-if="!emailSaved" class="email-hint">📧 付费解锁后会将完整深度报告发送到你的邮箱</p>
      </div>

      <div class="invite-card">
        <div>
          <h4 class="invite-title">邀请 1 位好友免费解锁</h4>
          <p class="invite-desc">好友通过你的链接认真完成所有测试（置信度≥92%）后，系统会自动把你的深度报告 PDF 发送到上方邮箱。</p>
        </div>
        <button class="btn-invite" :disabled="inviteLoading" @click="createInviteUnlock">
          {{ inviteLoading ? '生成中...' : '生成邀请链接' }}
        </button>
        <div v-if="inviteLink" class="invite-link-wrap">
          <input class="invite-link" :value="inviteLink" readonly />
          <button class="btn-copy" @click="copyInviteLink">{{ inviteCopied ? '已复制' : '复制' }}</button>
        </div>
        <p v-if="inviteError" class="qr-error">{{ inviteError }}</p>
      </div>

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
        <p class="qr-hint">请使用<strong>支付宝</strong>扫描二维码支付</p>
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
      🎉 解锁成功！向下滚动查看完整深度报告
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
.paywall-desc { font-size: 15px; color: #6B6560; line-height: 1.5; margin-bottom: 16px; }
.email-section { margin-bottom: 18px; }
.email-input-wrap { position: relative; display: flex; align-items: center; }
.email-input {
  width: 100%; padding: 14px 40px 14px 16px; border: 1.5px solid #E0D8CC; border-radius: 14px;
  font-size: 15px; color: #2D2A26; background: #FAF8F5; outline: none; transition: border-color .2s;
}
.email-input:focus { border-color: #C8963E; }
.email-input.email-saved { border-color: #2D8A4E; background: #F0FFF0; color: #2D8A4E; font-weight: 600; }
.email-check { position: absolute; right: 12px; font-size: 18px; }
.email-hint { font-size: 12px; color: #9C958E; margin-top: 6px; text-align: left; }
.email-error { font-size: 12px; color: #E8816B; margin-top: 4px; text-align: left; }
.invite-card { margin: 18px 0; padding: 16px; border: 1.5px dashed #C8963E66; border-radius: 16px; background: #FAF8F5; text-align: left; }
.invite-title { font-size: 15px; font-weight: 700; color: #2D2A26; margin-bottom: 6px; }
.invite-desc { font-size: 12px; color: #6B6560; line-height: 1.5; margin-bottom: 12px; }
.btn-invite { width: 100%; padding: 12px 16px; border: none; border-radius: 12px; background: #2D2A26; color: #FFF; font-size: 14px; font-weight: 700; cursor: pointer; }
.btn-invite:disabled { opacity: 0.65; cursor: not-allowed; }
.invite-link-wrap { display: flex; gap: 8px; margin-top: 10px; }
.invite-link { flex: 1; min-width: 0; padding: 10px; border: 1.5px solid #E0D8CC; border-radius: 10px; font-size: 12px; color: #6B6560; background: #FFF; }
.btn-copy { padding: 10px 14px; border: none; border-radius: 10px; background: #C8963E; color: #FFF; font-size: 12px; font-weight: 700; cursor: pointer; }
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
