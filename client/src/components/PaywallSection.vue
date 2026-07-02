<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { api } from '../services/api'

const props = defineProps<{ typeCode: string; typeName: string; typeColor: string; recordId?: string }>()
const emit = defineEmits<{ unlocked: [unlockToken: string]; requestSharePoster: [] }>()

const STORAGE_KEY = 'mbti-pro-share-unlocks'
const LEGACY_PAYMENT_KEY = 'mbti-pro-orders'

const isUnlocked = ref(false)
const unlockToken = ref('')
const unlockedRecords = ref<Record<string, string>>(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'))
const userEmail = ref(localStorage.getItem('mbti-pro-share-email') || '')
const emailSaved = ref(false)
const emailError = ref('')
const unlockLoading = ref(false)
const unlockError = ref('')
const unlockMessage = ref('')

const orderKey = () => props.recordId ? `${props.typeCode}:${props.recordId}` : ''

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function persistUnlock(token: string) {
  unlockToken.value = token
  const key = orderKey()
  if (!key) return
  unlockedRecords.value[key] = token
  localStorage.setItem(STORAGE_KEY, JSON.stringify(unlockedRecords.value))
}

function clearSavedUnlock() {
  const key = orderKey()
  if (!key) return
  delete unlockedRecords.value[key]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(unlockedRecords.value))
}

async function saveEmail() {
  if (!userEmail.value || !isValidEmail(userEmail.value)) {
    emailError.value = '请输入有效邮箱，用于接收深度报告 PDF'
    return false
  }
  try {
    await api.saveEmail(userEmail.value, props.typeCode, 'share_unlock')
    localStorage.setItem('mbti-pro-share-email', userEmail.value)
    localStorage.setItem('mbti-pro-referral-email', userEmail.value)
    emailSaved.value = true
    emailError.value = ''
    return true
  } catch {
    emailError.value = '邮箱保存失败，请重试'
    return false
  }
}

async function unlockByShare() {
  unlockError.value = ''
  unlockMessage.value = ''
  if (!props.recordId) {
    unlockError.value = '请先完整完成本次测试，再生成分享海报解锁。'
    return
  }
  if (!(await saveEmail())) return

  unlockLoading.value = true
  try {
    emit('requestSharePoster')
    const data = await api.createShareUnlock({
      recordId: props.recordId,
      typeCode: props.typeCode,
      email: userEmail.value,
      channel: 'share_poster',
    })
    persistUnlock(data.unlockToken)
    unlockMessage.value = '深度报告已解锁，PDF 正在自动发送到你的邮箱。请保存海报并分享给好友或发布到评论区支持 MBTI-PRO。'
    setTimeout(() => { isUnlocked.value = true }, 500)
  } catch (err: any) {
    unlockError.value = err.message || '解锁失败，请稍后重试。'
  } finally {
    unlockLoading.value = false
  }
}

async function verifySavedUnlock(token: string) {
  try {
    const data = await api.getResult(props.typeCode, token, props.recordId)
    if (data.paid) {
      persistUnlock(token)
      isUnlocked.value = true
    } else {
      clearSavedUnlock()
    }
  } catch {
    clearSavedUnlock()
  }
}

onMounted(() => {
  localStorage.removeItem(LEGACY_PAYMENT_KEY)
  const key = orderKey()
  const savedToken = key ? unlockedRecords.value[key] : ''
  if (savedToken) {
    unlockToken.value = savedToken
    verifySavedUnlock(savedToken)
  }
})

onUnmounted(() => {})

watch(isUnlocked, async (val) => {
  if (val) {
    emit('unlocked', unlockToken.value)
    await nextTick()
    document.querySelector('.paywall-unlocked')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
})
</script>

<template>
  <div class="paywall-section" v-if="!isUnlocked">
    <div class="paywall-card" :style="{ borderColor: typeColor + '33' }">
      <div class="lock-icon">🎁</div>
      <h3 class="paywall-title">免费解锁深度人格报告</h3>
      <p class="paywall-desc">填写邮箱并生成分享海报，即可解锁网页深度内容，系统会自动发送完整 PDF 到你的邮箱。</p>

      <div class="email-section">
        <div class="email-input-wrap">
          <input
            v-model="userEmail"
            type="email"
            placeholder="输入邮箱，接收完整深度报告 PDF"
            class="email-input"
            :class="{ 'email-saved': emailSaved }"
            @keyup.enter="unlockByShare"
          />
          <span v-if="emailSaved" class="email-check">✅</span>
        </div>
        <p v-if="emailError" class="email-error">{{ emailError }}</p>
      </div>

      <div class="share-card">
        <h4 class="share-title">生成海报并分享给任何人</h4>
        <p class="share-desc">你可以把海报分享到抖音、小红书、公众号评论区，也可以发给微信好友、朋友圈或其他社群。</p>
        <button class="btn-unlock" :style="{ background: typeColor }" :disabled="unlockLoading" @click="unlockByShare">
          <span v-if="unlockLoading" class="spinner" />
          {{ unlockLoading ? '生成并解锁中...' : '生成分享海报，免费解锁' }}
        </button>
      </div>

      <p v-if="unlockMessage" class="success-text">{{ unlockMessage }}</p>
      <p v-if="unlockError" class="qr-error">{{ unlockError }}</p>
    </div>
  </div>

  <div class="paywall-unlocked" v-else>
    <div class="unlocked-banner" :style="{ background: typeColor + '11', borderColor: typeColor + '33' }">
      🎉 已免费解锁！完整 PDF 会自动发送到你的邮箱，请继续向下查看深度报告。
    </div>
    <slot />
  </div>
</template>

<style scoped>
.paywall-section { margin: 24px 0; }
.paywall-card { background: #FFF; border: 1.5px solid; border-radius: 20px; padding: 32px 24px; text-align: center; }
.lock-icon { font-size: 40px; margin-bottom: 12px; }
.paywall-title { font-size: 22px; font-weight: 700; color: #2D2A26; margin-bottom: 8px; }
.paywall-desc { font-size: 15px; color: #6B6560; line-height: 1.6; margin-bottom: 18px; }
.email-section { margin-bottom: 18px; }
.email-input-wrap { position: relative; display: flex; align-items: center; }
.email-input { width: 100%; padding: 14px 40px 14px 16px; border: 1.5px solid #E0D8CC; border-radius: 14px; font-size: 15px; color: #2D2A26; background: #FAF8F5; outline: none; transition: border-color .2s; }
.email-input:focus { border-color: #C8963E; }
.email-input.email-saved { border-color: #2D8A4E; background: #F0FFF0; color: #2D8A4E; font-weight: 600; }
.email-check { position: absolute; right: 12px; font-size: 18px; }
.email-error { font-size: 12px; color: #E8816B; margin-top: 4px; text-align: left; }
.share-card { padding: 18px; border: 1.5px dashed #C8963E66; border-radius: 16px; background: #FAF8F5; text-align: left; }
.share-title { font-size: 16px; font-weight: 700; color: #2D2A26; margin-bottom: 6px; }
.share-desc { font-size: 13px; color: #6B6560; line-height: 1.6; margin-bottom: 12px; }
.btn-unlock { width: 100%; padding: 14px 18px; border: none; border-radius: 14px; color: #FFF; font-size: 16px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; }
.btn-unlock:hover:not(:disabled) { transform: translateY(-1px); }
.btn-unlock:disabled { opacity: 0.65; cursor: not-allowed; }
.success-text { margin-top: 12px; font-size: 13px; color: #2D8A4E; line-height: 1.6; text-align: left; }
.qr-error { margin-top: 10px; font-size: 13px; color: #E8816B; line-height: 1.5; text-align: left; }
.paywall-unlocked { margin: 16px 0; }
.unlocked-banner { border: 1.5px solid; border-radius: 12px; padding: 12px 20px; text-align: center; font-size: 15px; font-weight: 600; color: #2D2A26; margin-bottom: 16px; }
.spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #FFF; border-radius: 50%; animation: spin 0.6s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
