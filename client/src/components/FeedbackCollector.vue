<script setup lang="ts">
import { ref, computed } from 'vue'
import { api } from '../services/api'

const props = defineProps<{ userType: string; recordId?: string; lowConfidence?: boolean }>()
const emit = defineEmits<{ submitted: [] }>()

const TYPES = ['INTJ','INTP','ENTJ','ENTP','INFJ','INFP','ENFJ','ENFP','ISTJ','ISFJ','ESTJ','ESFJ','ISTP','ISFP','ESTP','ESFP']
const TYPE_NAMES: Record<string, string> = {
  INTJ: '建筑师', INTP: '逻辑学家', ENTJ: '指挥官', ENTP: '辩论家',
  INFJ: '提倡者', INFP: '调停者', ENFJ: '主人公', ENFP: '竞选者',
  ISTJ: '物流师', ISFJ: '守卫者', ESTJ: '总经理', ESFJ: '执政官',
  ISTP: '鉴赏家', ISFP: '探险家', ESTP: '企业家', ESFP: '表演者',
}

const likedType = ref('')
const dislikedType = ref('')
const submitted = ref(false)
const submitting = ref(false)
const submitError = ref(false)

const filteredTypes = computed(() => TYPES.filter(type => type !== props.userType))

async function submit() {
  if (!likedType.value || !dislikedType.value || submitting.value) return
  submitting.value = true
  submitError.value = false
  try {
    await api.submitFeedback(props.userType, likedType.value, dislikedType.value, props.recordId)
    submitted.value = true
    emit('submitted')
  } catch {
    submitError.value = true
  } finally {
    submitting.value = false
  }
}

function skip() {
  submitted.value = true
  emit('submitted')
}
</script>

<template>
  <div class="feedback-section" v-if="!submitted">
    <div class="fb-card">
      <div class="fb-icon">💬</div>
      <h3 class="fb-title">再补充 2 个相处偏好</h3>
      <p class="fb-desc">请选择你现实中最喜欢、最讨厌相处的传统 16 型人格。你的匿名反馈会帮助我们优化 81 型兼容性分析。</p>

      <div v-if="lowConfidence" class="fb-warning">
        ⚠️ 请认真完成所有题目再提交，不然结果页面仅展示默认结果（非真实测试结果）。
      </div>

      <div class="fb-rows">
        <div class="fb-row">
          <label>你相处最愉快的传统 16 型人格</label>
          <select v-model="likedType">
            <option value="">请选择</option>
            <option v-for="type in filteredTypes" :key="type" :value="type">{{ type }} {{ TYPE_NAMES[type] }}</option>
          </select>
        </div>
        <div class="fb-row">
          <label>你相处最痛苦的传统 16 型人格</label>
          <select v-model="dislikedType">
            <option value="">请选择</option>
            <option v-for="type in filteredTypes" :key="type" :value="type">{{ type }} {{ TYPE_NAMES[type] }}</option>
          </select>
        </div>
      </div>

      <button class="fb-submit" :disabled="!likedType || !dislikedType || submitting" @click="submit">
        {{ submitting ? '提交中...' : '提交并查看结果' }}
      </button>
      <p v-if="submitError" class="fb-error">网络异常，反馈未保存。你可以重试或跳过。</p>
      <button class="fb-skip" @click="skip">跳过，直接查看结果</button>
    </div>
  </div>
  <div class="feedback-done" v-else>
    <p>✅ 感谢反馈，正在生成你的结果页。</p>
  </div>
</template>

<style scoped>
.feedback-section { margin: 32px 0; }
.fb-card { background: #FFF; border: 1.5px solid #E0D8CC; border-radius: 24px; padding: 30px 24px; box-shadow: 0 18px 50px rgba(45, 42, 38, 0.14); }
.fb-icon { font-size: 34px; margin-bottom: 10px; text-align: center; }
.fb-title { font-size: 22px; font-weight: 800; color: #2D2A26; margin-bottom: 8px; text-align: center; }
.fb-desc { font-size: 14px; color: #6B6560; line-height: 1.7; margin-bottom: 18px; text-align: center; }
.fb-warning { background: #FFF4E5; border: 1.5px solid #F0C36A; color: #8A5A12; border-radius: 14px; padding: 12px 14px; font-size: 13px; line-height: 1.6; margin-bottom: 16px; font-weight: 600; }
.fb-rows { display: flex; flex-direction: column; gap: 14px; }
.fb-row { display: flex; flex-direction: column; gap: 7px; }
.fb-row label { font-size: 14px; font-weight: 700; color: #4A4540; }
.fb-row select { padding: 12px 14px; border: 1.5px solid #E0D8CC; border-radius: 12px; font-size: 15px; background: #FAF8F5; color: #2D2A26; outline: none; }
.fb-row select:focus { border-color: #C8963E; }
.fb-submit { margin-top: 20px; width: 100%; padding: 13px; background: #2D2A26; color: #FFF; border: none; border-radius: 14px; font-size: 16px; font-weight: 700; cursor: pointer; }
.fb-submit:disabled { opacity: 0.4; cursor: not-allowed; }
.fb-error { color: #E8816B; font-size: 13px; margin-top: 10px; text-align: center; }
.fb-skip { background: none; border: none; padding: 12px 20px 0; font-size: 14px; color: #9C958E; cursor: pointer; width: 100%; }
.fb-skip:hover { color: #6B6560; text-decoration: underline; }
.feedback-done { margin: 32px 0; padding: 16px; background: #2D8A4E11; border-radius: 12px; text-align: center; font-size: 14px; color: #2D8A4E; }
</style>
