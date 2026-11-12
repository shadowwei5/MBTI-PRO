<script setup lang="ts">
import { ref } from 'vue'
import { agreePrivacy } from '../services/consent'

/**
 * 隐私"显式单独同意"闸门
 *
 * PIPL 要求处理敏感个人信息（答题记录、用时等）需取得单独同意，
 * 且不能与用户协议打包成一个勾选框。因此：
 * - 单独一条勾选项，只对应"答题数据用于生成报告"这件事；
 * - 协议链接仅作阅读入口，不随勾选默认带上；
 * - 同意记录存 localStorage（见 services/consent.ts），再次进入不重复打扰。
 */

const checked = ref(false)
const emit = defineEmits<{ agreed: [] }>()

function agree() {
  if (!checked.value) return
  agreePrivacy()
  emit('agreed')
}
</script>

<template>
  <div class="consent-overlay">
    <div class="consent-backdrop" />
    <div class="consent-panel">
      <p class="consent-kicker">BEFORE YOU BEGIN / 01</p>
      <h3 class="consent-title">开始前，一件事</h3>
      <p class="consent-lead">
        测评会记录你的作答选择、四维得分与每题用时，用于生成你的人格报告。这份记录属于你的个人信息。
      </p>

      <label class="consent-check">
        <input v-model="checked" type="checkbox" class="consent-box" />
        <span class="consent-check-text">
          我已单独知晓并<b>同意</b>：将我的答题数据用于生成报告（不用于广告、不出售、不用于雇佣评估）。
        </span>
      </label>

      <p class="consent-links">
        阅读后再决定：
        <RouterLink to="/privacy">隐私政策</RouterLink>
        <span aria-hidden="true">·</span>
        <RouterLink to="/terms">用户协议</RouterLink>
      </p>

      <button type="button" class="consent-button" :disabled="!checked" @click="agree">
        同意并开始测试
      </button>
      <p class="consent-foot">不同意也可以离开；我们不收集姓名、手机号或身份证号。</p>
    </div>
  </div>
</template>

<style scoped>
.consent-overlay { position: fixed; inset: 0; z-index: 60; display: flex; align-items: flex-end; justify-content: center; }
.consent-backdrop { position: absolute; inset: 0; background: rgba(30, 29, 26, .58); backdrop-filter: blur(3px); }
.consent-panel {
  position: relative; width: 100%; max-width: 560px;
  margin: 0 16px 16px; padding: 26px 24px 22px;
  border: 1px solid #1e1d1a; border-radius: 2px; background: #f8f4ec; color: #1e1d1a;
}
.consent-kicker { margin: 0 0 12px; color: #a63d2c; font-family: "DM Mono", "SF Mono", Consolas, monospace; font-size: 9px; letter-spacing: .12em; }
.consent-title { margin: 0; font-family: "Playfair Display", "Songti SC", "STSong", SimSun, "Noto Serif CJK SC", serif; font-size: 24px; font-weight: 600; letter-spacing: -.03em; }
.consent-lead { margin: 12px 0 0; color: #6f685d; font-size: 13px; line-height: 1.85; }

.consent-check { display: flex; align-items: flex-start; gap: 12px; margin-top: 18px; padding: 14px; border: 1px solid #d2c8b8; background: #f2ede3; cursor: pointer; }
.consent-box { width: 18px; height: 18px; margin: 2px 0 0; accent-color: #a63d2c; flex: none; }
.consent-check-text { font-size: 13px; line-height: 1.8; }
.consent-check-text b { color: #a63d2c; }

.consent-links { margin: 14px 0 0; color: #6f685d; font-size: 12px; }
.consent-links a { color: #6f685d; text-decoration: none; border-bottom: 1px solid #d2c8b8; }
.consent-links a:hover { color: #a63d2c; border-bottom-color: #a63d2c; }
.consent-links span { margin: 0 6px; color: #d2c8b8; }

.consent-button {
  width: 100%; margin-top: 18px; padding: 15px 18px;
  border: 1px solid #1e1d1a; border-radius: 2px; background: #1e1d1a; color: #f8f4ec;
  font-size: 14px; font-weight: 600;
}
.consent-button:disabled { opacity: .35; cursor: not-allowed; }
.consent-button:not(:disabled):hover { background: #a63d2c; border-color: #a63d2c; }

.consent-foot { margin: 12px 0 0; color: #6f685d; font-size: 11px; line-height: 1.7; }

@media (min-width: 681px) {
  .consent-overlay { align-items: center; }
}
</style>
