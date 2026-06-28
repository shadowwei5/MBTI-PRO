<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{ typeCode: string; typeName: string; typeColor: string }>()

const isUnlocked = ref(false)
const showQR = ref(false)
const unlockedByShare = ref(false)

function shareToUnlock() {
  const shareText = `我刚测了MBTI-PRO的81型人格测试，我是${props.typeName}！你也来测测你是哪种人格？`
  const shareUrl = `https://mbti-pro.com/?ref=share&type=${props.typeCode}`
  if (navigator.share) {
    navigator.share({ title: 'MBTI-PRO 81型人格测试', text: shareText, url: shareUrl })
      .then(() => { isUnlocked.value = true; unlockedByShare.value = true })
      .catch(() => {})
  } else {
    navigator.clipboard.writeText(`${shareText}\n${shareUrl}`).then(() => {
      isUnlocked.value = true; unlockedByShare.value = true
    })
  }
}

function payToUnlock() {
  alert('支付功能开发中。敬请期待！\n\n即将支持微信/支付宝扫码支付 ¥4.9')
  showQR.value = true
}
</script>

<template>
  <div class="paywall-section" v-if="!isUnlocked">
    <div class="paywall-card" :style="{ borderColor: typeColor + '33' }">
      <div class="lock-icon">🔒</div>
      <h3 class="paywall-title">解锁深度人格报告</h3>
      <p class="paywall-desc">包含四维深度解析、网络特质标签、职业详细推荐、相处兼容性分析</p>

      <div class="paywall-actions">
        <button class="btn-unlock" :style="{ background: typeColor }" @click="payToUnlock">
          ¥4.9 立即解锁
        </button>
        <button class="btn-share" @click="shareToUnlock">
          📤 邀请 1 位好友测试 → 免费解锁
        </button>
      </div>

      <p class="paywall-note">支付后永久解锁 {{ typeName }} 的完整报告</p>

      <div v-if="showQR" class="qr-placeholder" :style="{ borderColor: typeColor + '44' }">
        <div class="qr-inner">
          <p>微信/支付宝扫码支付 ¥4.9</p>
          <p style="font-size:12px;color:#9C958E">（支付功能即将上线，敬请期待）</p>
        </div>
      </div>
    </div>
  </div>

  <div class="paywall-unlocked" v-else>
    <div class="unlocked-banner" :style="{ background: typeColor + '11', borderColor: typeColor + '33' }">
      <template v-if="unlockedByShare">✅ 已通过分享解锁 · 深度内容已开放</template>
      <template v-else>✅ 已解锁 · 完整深度报告</template>
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
}
.btn-unlock:hover { transform: scale(1.03); }
.btn-share {
  background: none; border: 1.5px solid #E0D8CC; border-radius: 14px;
  padding: 12px 28px; font-size: 16px; color: #6B6560; cursor: pointer;
}
.paywall-note { font-size: 13px; color: #9C958E; margin-top: 16px; }
.qr-placeholder {
  margin-top: 20px; border: 1.5px dashed; border-radius: 16px; padding: 24px;
}
.qr-inner p { font-size: 15px; color: #2D2A26; margin-bottom: 8px; }

.paywall-unlocked { margin: 16px 0; }
.unlocked-banner {
  border: 1.5px solid; border-radius: 12px; padding: 12px 20px;
  text-align: center; font-size: 15px; font-weight: 600; color: #2D2A26; margin-bottom: 16px;
}
</style>
