<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { api } from '../services/api'

const props = defineProps<{ typeCode: string; typeName: string; typeColor: string; recordId?: string }>()
const emit = defineEmits<{ unlocked: [unlockToken: string] }>()

const STORAGE_KEY = 'mbti-pro-orders'
const LEGACY_STORAGE_KEY = 'mbti-pro-orders-legacy-cleared-v2'

const isUnlocked = ref(false)
const unlockToken = ref('')
const unlockedOrders = ref<Record<string, string>>(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'))
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
const socialPlatform = ref<'douyin' | 'xiaohongshu'>('douyin')
const socialHandle = ref('')
const socialComment = ref('')
const socialScreenshot = ref('')
const socialFileName = ref('')
const socialLoading = ref(false)
const socialError = ref('')
const socialMessage = ref('')
let pollTimer: ReturnType<typeof setInterval> | null = null

const orderKey = () => props.recordId ? `${props.typeCode}:${props.recordId}` : ''

if (!localStorage.getItem(LEGACY_STORAGE_KEY)) {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.setItem(LEGACY_STORAGE_KEY, '1')
  unlockedOrders.value = {}
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function persistUnlock(token: string) {
  unlockToken.value = token
  const key = orderKey()
  if (!key) return
  unlockedOrders.value[key] = token
  localStorage.setItem(STORAGE_KEY, JSON.stringify(unlockedOrders.value))
}

function clearSavedUnlock() {
  const key = orderKey()
  if (!key) return
  delete unlockedOrders.value[key]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(unlockedOrders.value))
}

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

async function ensureEmail() {
  if (!userEmail.value || !isValidEmail(userEmail.value)) {
    emailError.value = '请输入有效邮箱，用于接收深度报告 PDF'
    return false
  }
  if (emailSaved.value) return true
  return saveEmail()
}

async function payToUnlock() {
  emailError.value = ''
  qrError.value = ''
  if (!(await ensureEmail())) return
  if (!props.recordId) {
    qrError.value = '请先完整完成本次测试，再解锁深度报告。'
    return
  }

  qrLoading.value = true
  payStatus.value = 'loading'
  try {
    const data = await api.createPayment(
      props.typeCode,
      props.typeName,
      userEmail.value || undefined,
      localStorage.getItem('mbti-pro-referral-code') || undefined,
      props.recordId,
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
    inviteError.value = '请从完整测试结果页生成邀请链接。'
    return
  }
  if (!(await ensureEmail())) return

  inviteLoading.value = true
  try {
    const reward = await api.createReferral(props.recordId, props.typeCode, userEmail.value)
    localStorage.setItem('mbti-pro-referral-email', userEmail.value)
    inviteLink.value = `${window.location.origin}/test?ref=${reward.code}`
  } catch (err: any) {
    inviteError.value = err.message || '生成邀请链接失败，请稍后重试。'
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

function onScreenshotChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  socialError.value = ''
  socialMessage.value = ''
  socialScreenshot.value = ''
  socialFileName.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) {
    socialError.value = '请上传图片格式的截图。'
    return
  }
  if (file.size > 4 * 1024 * 1024) {
    socialError.value = '截图不能超过 4MB，请压缩后再上传。'
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    socialScreenshot.value = String(reader.result || '')
    socialFileName.value = file.name
  }
  reader.onerror = () => {
    socialError.value = '读取截图失败，请重新选择。'
  }
  reader.readAsDataURL(file)
}

async function submitSocialUnlock() {
  socialError.value = ''
  socialMessage.value = ''
  if (!props.recordId) {
    socialError.value = '请先完整完成本次测试，再提交截图申请。'
    return
  }
  if (!(await ensureEmail())) return
  if (!socialScreenshot.value) {
    socialError.value = '请上传你在抖音或小红书评论区附上海报的截图。'
    return
  }

  socialLoading.value = true
  try {
    const result = await api.submitSocialUnlock({
      recordId: props.recordId,
      typeCode: props.typeCode,
      email: userEmail.value,
      platform: socialPlatform.value,
      socialHandle: socialHandle.value || undefined,
      commentText: socialComment.value || undefined,
      screenshotData: socialScreenshot.value,
    })
    socialMessage.value = result.message || '申请已提交，审核通过后会自动发送 PDF 到邮箱。'
  } catch (err: any) {
    socialError.value = err.message || '提交失败，请稍后重试。'
  } finally {
    socialLoading.value = false
  }
}

async function checkAndUnlock() {
  if (!unlockToken.value || !props.recordId) return false
  try {
    const data = await api.checkPayment(props.typeCode, unlockToken.value, props.recordId)
    if (data.paid) {
      payStatus.value = 'paid'
      stopPolling()
      setTimeout(() => {
        persistUnlock(unlockToken.value)
        isUnlocked.value = true
      }, 800)
      return true
    }
  } catch {
    // retry next poll
  }
  return false
}

function startPolling() {
  stopPolling()
  checkAndUnlock()
  pollTimer = setInterval(() => { checkAndUnlock() }, 2000)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function onVisibilityChange() {
  if (document.visibilityState === 'visible' && pollTimer) checkAndUnlock()
}

async function verifySavedUnlock(token: string) {
  try {
    const data = await api.checkPayment(props.typeCode, token, props.recordId)
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
  const key = orderKey()
  const savedToken = key ? unlockedOrders.value[key] : ''
  if (savedToken) {
    unlockToken.value = savedToken
    verifySavedUnlock(savedToken)
  }
  document.addEventListener('visibilitychange', onVisibilityChange)
})

onUnmounted(() => {
  stopPolling()
  document.removeEventListener('visibilitychange', onVisibilityChange)
})

watch(isUnlocked, async (val) => {
  if (val) {
    emit('unlocked', unlockToken.value)
    await nextTick()
    document.querySelector('.paywall-unlocked')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
})

function getQRImageUrl(data: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data)}`
}
</script>

<template>
  <div class="paywall-section" v-if="!isUnlocked">
    <div class="paywall-card" :style="{ borderColor: typeColor + '33' }">
      <div class="lock-icon">🔒</div>
      <h3 class="paywall-title">解锁深度人格报告</h3>
      <p class="paywall-desc">包含人格概览、四维日常画像、代表人物、核心优势、成长空间和四维深度解析。</p>

      <div class="email-section">
        <div class="email-input-wrap">
          <input
            v-model="userEmail"
            type="email"
            placeholder="输入邮箱，解锁后发送完整报告 PDF"
            class="email-input"
            :class="{ 'email-saved': emailSaved }"
            :disabled="emailSaved"
            @keyup.enter="payToUnlock"
          />
          <span v-if="emailSaved" class="email-check">✅</span>
        </div>
        <p v-if="emailError" class="email-error">{{ emailError }}</p>
        <p v-if="!emailSaved" class="email-hint">📧 解锁后会将完整深度报告 PDF 自动发送到你的邮箱</p>
      </div>

      <div class="unlock-grid">
        <div class="unlock-card primary-card">
          <h4 class="unlock-title">¥4.9 立即解锁</h4>
          <p class="unlock-desc">支付宝扫码后自动解锁网页内容，并立即发送 PDF 报告到邮箱。</p>
          <button class="btn-unlock" :style="{ background: typeColor }" :disabled="qrLoading" @click="payToUnlock">
            <span v-if="qrLoading" class="spinner" />
            {{ qrLoading ? '生成中...' : '立即解锁' }}
          </button>
        </div>

        <div class="unlock-card">
          <h4 class="unlock-title">邀请 1 位好友免费解锁</h4>
          <p class="unlock-desc">好友通过你的链接认真完成所有测试（置信度≥92%）后，系统会自动把报告 PDF 发送到上方邮箱。</p>
          <button class="btn-secondary" :disabled="inviteLoading" @click="createInviteUnlock">
            {{ inviteLoading ? '生成中...' : '生成邀请链接' }}
          </button>
          <div v-if="inviteLink" class="invite-link-wrap">
            <input class="invite-link" :value="inviteLink" readonly />
            <button class="btn-copy" @click="copyInviteLink">{{ inviteCopied ? '已复制' : '复制' }}</button>
          </div>
          <p v-if="inviteError" class="qr-error">{{ inviteError }}</p>
        </div>
      </div>

      <div class="social-card">
        <div class="social-header">
          <h4 class="unlock-title">评论区晒海报免费解锁</h4>
          <p class="unlock-desc">在我的抖音或小红书账号评论区文字评论并附上分享海报，上传截图后等待人工审核；审核通过会自动发送 PDF 到邮箱，无需在网页等待。</p>
        </div>
        <div class="social-form">
          <div class="platform-row">
            <label><input v-model="socialPlatform" type="radio" value="douyin" /> 抖音</label>
            <label><input v-model="socialPlatform" type="radio" value="xiaohongshu" /> 小红书</label>
          </div>
          <input v-model="socialHandle" class="text-input" placeholder="你的平台昵称（选填，便于审核）" />
          <textarea v-model="socialComment" class="text-input textarea" rows="2" placeholder="评论文字或备注（选填）" />
          <label class="file-picker">
            <input type="file" accept="image/png,image/jpeg,image/webp" @change="onScreenshotChange" />
            <span>{{ socialFileName || '上传评论区截图' }}</span>
          </label>
          <button class="btn-secondary" :disabled="socialLoading" @click="submitSocialUnlock">
            {{ socialLoading ? '提交中...' : '提交人工审核' }}
          </button>
        </div>
        <p v-if="socialMessage" class="success-text">{{ socialMessage }}</p>
        <p v-if="socialError" class="qr-error">{{ socialError }}</p>
      </div>

      <div v-if="showQR && qrUrl" class="qr-section">
        <p class="qr-hint">请使用 <strong>支付宝</strong> 扫描二维码支付</p>
        <div class="qr-code-wrap">
          <img :src="getQRImageUrl(qrUrl)" alt="支付二维码" class="qr-img" />
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
      🎉 解锁成功！请向下滚动查看完整深度报告，PDF 已自动发送到你的邮箱。
    </div>
    <slot />
  </div>
</template>

<style scoped>
.paywall-section { margin: 24px 0; }
.paywall-card { background: #FFF; border: 1.5px solid; border-radius: 20px; padding: 32px 24px; text-align: center; }
.lock-icon { font-size: 40px; margin-bottom: 12px; }
.paywall-title { font-size: 22px; font-weight: 700; color: #2D2A26; margin-bottom: 8px; }
.paywall-desc { font-size: 15px; color: #6B6560; line-height: 1.5; margin-bottom: 16px; }
.email-section { margin-bottom: 18px; }
.email-input-wrap { position: relative; display: flex; align-items: center; }
.email-input { width: 100%; padding: 14px 40px 14px 16px; border: 1.5px solid #E0D8CC; border-radius: 14px; font-size: 15px; color: #2D2A26; background: #FAF8F5; outline: none; transition: border-color .2s; }
.email-input:focus { border-color: #C8963E; }
.email-input.email-saved { border-color: #2D8A4E; background: #F0FFF0; color: #2D8A4E; font-weight: 600; }
.email-check { position: absolute; right: 12px; font-size: 18px; }
.email-hint { font-size: 12px; color: #9C958E; margin-top: 6px; text-align: left; }
.email-error { font-size: 12px; color: #E8816B; margin-top: 4px; text-align: left; }
.unlock-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin: 18px 0; }
.unlock-card, .social-card { padding: 16px; border: 1.5px dashed #C8963E66; border-radius: 16px; background: #FAF8F5; text-align: left; }
.primary-card { border-style: solid; background: #FFFDF8; }
.unlock-title { font-size: 15px; font-weight: 700; color: #2D2A26; margin-bottom: 6px; }
.unlock-desc { font-size: 12px; color: #6B6560; line-height: 1.5; margin-bottom: 12px; }
.btn-unlock, .btn-secondary { width: 100%; padding: 12px 16px; border: none; border-radius: 12px; color: #FFF; font-size: 14px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; }
.btn-secondary { background: #2D2A26; }
.btn-unlock:hover:not(:disabled), .btn-secondary:hover:not(:disabled) { transform: translateY(-1px); }
.btn-unlock:disabled, .btn-secondary:disabled { opacity: 0.65; cursor: not-allowed; }
.invite-link-wrap { display: flex; gap: 8px; margin-top: 10px; }
.invite-link { flex: 1; min-width: 0; padding: 10px; border: 1.5px solid #E0D8CC; border-radius: 10px; font-size: 12px; color: #6B6560; background: #FFF; }
.btn-copy { padding: 10px 14px; border: none; border-radius: 10px; background: #C8963E; color: #FFF; font-size: 12px; font-weight: 700; cursor: pointer; }
.social-card { margin-top: 14px; }
.platform-row { display: flex; gap: 16px; margin-bottom: 10px; font-size: 13px; color: #2D2A26; }
.platform-row label { display: flex; align-items: center; gap: 6px; }
.text-input { width: 100%; box-sizing: border-box; margin-bottom: 10px; padding: 10px 12px; border: 1.5px solid #E0D8CC; border-radius: 10px; background: #FFF; color: #2D2A26; font-size: 13px; outline: none; }
.textarea { resize: vertical; font-family: inherit; }
.file-picker { display: flex; align-items: center; justify-content: center; min-height: 40px; margin-bottom: 10px; border: 1.5px dashed #C8963E; border-radius: 10px; background: #FFF; color: #C8963E; font-size: 13px; font-weight: 700; cursor: pointer; }
.file-picker input { display: none; }
.success-text { margin-top: 10px; font-size: 13px; color: #2D8A4E; line-height: 1.5; }
.qr-section { margin-top: 24px; }
.qr-hint { font-size: 14px; color: #6B6560; margin-bottom: 16px; }
.qr-code-wrap { display: inline-block; position: relative; border: 2px solid #E0D8CC; border-radius: 16px; padding: 12px; background: #FFF; }
.qr-img { display: block; width: 200px; height: 200px; }
.paid-overlay { position: absolute; inset: 0; background: rgba(45, 138, 78, 0.92); border-radius: 14px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #FFF; font-size: 18px; font-weight: 700; }
.paid-check { font-size: 40px; margin-bottom: 4px; }
.qr-price { font-size: 20px; font-weight: 700; color: #2D2A26; margin-top: 8px; }
.qr-polling { font-size: 13px; color: #9C958E; margin-top: 4px; }
.paid-text { color: #2D8A4E; font-weight: 600; }
.qr-error { margin-top: 10px; font-size: 13px; color: #E8816B; line-height: 1.5; }
.paywall-unlocked { margin: 16px 0; }
.unlocked-banner { border: 1.5px solid; border-radius: 12px; padding: 12px 20px; text-align: center; font-size: 15px; font-weight: 600; color: #2D2A26; margin-bottom: 16px; }
.spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #FFF; border-radius: 50%; animation: spin 0.6s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 720px) { .unlock-grid { grid-template-columns: 1fr; } .paywall-card { padding: 28px 18px; } }
</style>
