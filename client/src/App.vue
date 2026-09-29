<script setup lang="ts">
import { RouterView } from 'vue-router'
import { IS_DEMO } from './services/demoMode'
</script>

<template>
  <div class="min-h-screen noise-bg">
    <div v-if="IS_DEMO" class="demo-banner">
      <span class="demo-banner-tag">演示环境</span>
      <span class="demo-banner-text">
        本站为静态演示版：题库与人格内容为真实数据，支付与邮件服务已停用，不会产生任何收费。
      </span>
    </div>
    <RouterView v-slot="{ Component, route }">
      <Transition name="page" mode="out-in">
        <component :is="Component" :key="route.path" />
      </Transition>
    </RouterView>
  </div>
</template>

<style>
.demo-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 9px 16px;
  background: #2D2A26;
  color: #F5F1EA;
  font-size: 13px;
  line-height: 1.5;
  text-align: center;
}
.demo-banner-tag {
  flex: none;
  padding: 2px 8px;
  border-radius: 999px;
  background: #C8963E;
  color: #2D2A26;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: .04em;
}
.demo-banner-text { opacity: .92; }

.page-enter-active,
.page-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.page-enter-from {
  opacity: 0;
  transform: translateY(12px);
}
.page-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}
</style>
