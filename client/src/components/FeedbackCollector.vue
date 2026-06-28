<script setup lang="ts">
import { ref, computed } from 'vue'
import { api } from '../services/api'

const props = defineProps<{ userType: string }>()

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

async function submit() {
  if (!likedType.value || !dislikedType.value || submitting.value) return
  submitting.value = true
  try {
    await api.submitFeedback(props.userType, likedType.value, dislikedType.value)
    submitted.value = true
  } catch { submitting.value = false }
}
</script>

<template>
  <div class="feedback-section" v-if="!submitted">
    <div class="fb-card">
      <h3 class="fb-title">💡 帮助我们提供更精准的分析</h3>
      <p class="fb-desc">你的数据将用于生成真实用户相处偏好报告</p>
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
.feedback-done {
  margin: 32px 0; padding: 16px; background: #2D8A4E11;
  border-radius: 12px; text-align: center; font-size: 14px; color: #2D8A4E;
}
</style>
