<script setup lang="ts">
import { ref, computed } from 'vue'
import { api } from '../services/api'

const props = defineProps<{ userType: string; recordId?: string; lowConfidence?: boolean }>()
const emit = defineEmits<{ submitted: [] }>()

const TYPES = ['INTJ','INTP','ENTJ','ENTP','INFJ','INFP','ENFJ','ENFP','ISTJ','ISFJ','ESTJ','ESFJ','ISTP','ISFP','ESTP','ESFP']
const TYPE_NAMES: Record<string, string> = {
  INTJ:'建筑师', INTP:'逻辑学家', ENTJ:'指挥官', ENTP:'辩论家',
  INFJ:'提倡者', INFP:'调停者', ENFJ:'主人公', ENFP:'竞选者',
  ISTJ:'物流师', ISFJ:'守卫者', ESTJ:'总经理', ESFJ:'执政官',
  ISTP:'鉴赏家', ISFP:'探险家', ESTP:'企业家', ESFP:'表演者',
}

const likedType = ref('')
const dislikedType = ref('')
const submitted = ref(false)
const submitting = ref(false)

const filteredTypes = computed(() =>
  TYPES.filter(t => t !== props.userType)
)

const submitError = ref(false)

async function submit() {
  if (!likedType.value || !dislikedType.value || submitting.value) return
  submitting.value = true
  submitError.value = false
  try {
    await api.submitFeedback(props.userType, likedType.value, dislikedType.value, props.recordId)
  } catch {
    submitError.value = true
    submitting.value = false
    return
  }
  submitted.value = true
  emit('submitted')
}
</script>

<template>
  <div class="feedback-section" v-if="!submitted">
    <div class="fb-card">
      <h3 class="fb-title">💡 帮助我们提供更精准的分析</h3>
      <p class="fb-desc">你的数据将用于生成真实用户相处偏好报告</p>
      <div v-if="lowConfidence" class="fb-warning">
        ⚠️ 请认真完成所有题目再提交，不然结果页面仅展示默认结果（非真实测试结果）。
      </div>
      <div class="fb-rows">
        <div class="fb-row">
          <label>与你相处最愉快的 MBTI 类型：</label>
          <select v-model="likedType">
            <option value="">-- 请选择 --</option>
            <option v-for="t in filteredTypes" :key="t" :value="t">{{ t }} {{ TYPE_NAMES[t] || '' }}</option>
          </select>
        </div>
        <div class="fb-row">
          <label>与你相处最痛苦的类型：</label>
          <select v-model="dislikedType">
            <option value="">-- 请选择 --</option>
            <option v-for="t in filteredTypes" :key="t" :value="t">{{ t }} {{ TYPE_NAMES[t] || '' }}</option>
          </select>
        </div>
      </div>
      <button class="fb-submit" :disabled="!likedType || !dislikedType || submitting" @click="submit">
        {{ submitting ? '提交中...' : '提交反馈' }}
      </button>
      <p v-if="submitError" class="fb-error">⚠️ 网络异常，请重试或直接跳过</p>
      <button v-if="submitError" class="fb-skip" @click="submitted = true; emit('submitted')">跳过反馈，直接查看结果 →</button>
    </div>
  </div>
  <div class="feedback-done" v-else>
    <p>✅ 感谢反馈！你的数据已匿名记录，将用于提升兼容性分析准确度。</p>
  </div>
</template>

<style scoped>
.feedback-section { margin: 32px 0; }
.fb-card {
  background: #F5F0E8; border-radius: 16px; padding: 28px 24px;
}
.fb-title { font-size: 18px; font-weight: 700; color: #2D2A26; margin-bottom: 6px; }
.fb-desc { font-size: 14px; color: #8A827C; margin-bottom: 20px; }
.fb-warning { background: #FFF4E5; border: 1.5px solid #F0C36A; color: #8A5A12; border-radius: 12px; padding: 10px 12px; font-size: 13px; line-height: 1.5; margin-bottom: 16px; }
.fb-rows { display: flex; flex-direction: column; gap: 14px; }
.fb-row { display: flex; flex-direction: column; gap: 6px; }
.fb-row label { font-size: 14px; font-weight: 600; color: #6B6560; }
.fb-row select {
  padding: 10px 14px; border: 1.5px solid #E0D8CC; border-radius: 10px;
  font-size: 15px; background: #FFF; color: #2D2A26;
}
.fb-submit {
  margin-top: 20px; width: 100%; padding: 12px;
  background: #2D2A26; color: #FFF; border: none; border-radius: 12px;
  font-size: 16px; font-weight: 600; cursor: pointer;
}
.fb-submit:disabled { opacity: 0.4; cursor: not-allowed; }
.fb-error { color: #E8816B; font-size: 13px; margin-top: 8px; text-align: center; }
.fb-skip { background: none; border: 1.5px solid #E0D8CC; border-radius: 12px; padding: 10px 20px; font-size: 14px; color: #6B6560; cursor: pointer; margin-top: 8px; width: 100%; }
.fb-skip:hover { background: #F8F4EC; }
.feedback-done {
  margin: 32px 0; padding: 16px; background: #2D8A4E11;
  border-radius: 12px; text-align: center; font-size: 14px; color: #2D8A4E;
}
</style>
