<script setup lang="ts">
import { ref, onMounted } from 'vue'


interface DashboardData {
  overview: {
    totalTests: number; todayTests: number; weekTests: number
    totalFeedbacks: number; totalEmails: number; todayEmails: number
    avgDurationSec: number; completionRate: number
  }
  typeDistribution: { code: string; count: number }[]
  todayTypeDistribution: { code: string; count: number }[]
  topLiked: { type: string; count: number }[]
  topDisliked: { type: string; count: number }[]
  questionTimingStats: { questionId: number; dimension: string; dimensionLabel?: string; type: string; typeLabel?: string; sortOrder: number; label: string; samples: number; avgSec: number; medianSec: number }[]
  referralFunnel: { shares: number; clicks: number; validCompletions: number; rewardUnlocks: number; referredPaid: number }
  shareUnlockFunnel?: { unlocks: number; sentReports: number; todayUnlocks: number; channels: { channel: string; count: number }[] }
  dailyTrend: { date: string; count: number }[]
  utmSources: { source: string; count: number }[]
}

const data = ref<DashboardData | null>(null)
const loading = ref(true)
const error = ref('')
const emails = ref<{ email: string; typeCode: string; source: string; createdAt: string }[]>([])
const showEmails = ref(false)
onMounted(async () => {
  try {
    const API_BASE = import.meta.env.VITE_API_BASE || '/api'
    const [statsRes, emailsRes] = await Promise.all([
      fetch(`${API_BASE}/admin/stats`),
      fetch(`${API_BASE}/admin/emails?key=mbti-pro-admin-2026`),
    ])
    if (!statsRes.ok) throw new Error('Stats failed')
    const statsJson = await statsRes.json()
    if (statsJson.success) data.value = statsJson.data
    else error.value = statsJson.error || 'Unknown error'

    if (emailsRes.ok) {
      const emailsJson = await emailsRes.json()
      if (emailsJson.success) emails.value = emailsJson.data
    }
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})

function barMax(items: { count: number }[]) {
  return Math.max(...items.map(i => i.count), 1)
}

function formatSec(s: number) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}分${sec}秒`
}

function formatShortSec(s: number) {
  return `${Math.round(s * 10) / 10}s`
}

function sourceLabel(source: string) {
  const labels: Record<string, string> = {
    direct: '直接访问',
    share_poster: '分享海报',
    referral: '邀请链接',
    codex_deploy_check: '部署测试',
    codex_referral_check: '邀请链路测试',
  }
  return labels[source] || source || '直接访问'
}

function emailSourceLabel(source: string) {
  const labels: Record<string, string> = {
    paywall: '解锁弹窗',
    footer: '页脚订阅',
    quiz: '测试流程',
  }
  return labels[source] || source
}

async function copyEmails() {
  const text = emails.value.map(e => e.email).join('\n')
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // fallback
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
}
</script>

<template>
  <div class="min-h-screen bg-[#F5F2EC] p-4 md:p-8">
    <div class="max-w-7xl mx-auto">
      <!-- Header -->
      <div class="flex items-center justify-between mb-8">
        <div>
          <h1 class="text-2xl md:text-3xl font-display font-bold text-charcoal">MBTI-PRO 管理后台</h1>
          <p class="text-sm text-text-muted mt-1">数据每5分钟自动更新 · 实时仪表盘</p>
        </div>
        <button @click="showEmails = !showEmails" class="px-4 py-2 bg-charcoal text-cream rounded-xl text-sm font-semibold hover:bg-charcoal/80 transition">
          {{ showEmails ? '隐藏邮箱' : `📧 邮箱列表 (${emails.length})` }}
        </button>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="text-center py-20">
        <div class="w-10 h-10 mx-auto mb-4 rounded-full border-4 border-coral-soft border-t-coral animate-spin" />
        <p class="text-text-muted">加载数据中...</p>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="text-center py-20">
        <p class="text-coral">{{ error }}</p>
      </div>

      <!-- Dashboard Content -->
      <template v-else-if="data">
        <div class="bg-white rounded-2xl p-6 shadow-sm border border-border/30 mb-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-sm font-semibold text-charcoal uppercase tracking-wider">免费分享解锁漏斗</h2>
            <span class="text-xs text-text-muted">冷启动阶段：邮箱 + 海报生成即解锁</span>
          </div>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div class="bg-surface-alt rounded-xl p-4">
              <p class="text-xs text-text-muted mb-1">累计解锁</p>
              <p class="text-2xl font-bold text-coral">{{ data.shareUnlockFunnel?.unlocks || 0 }}</p>
            </div>
            <div class="bg-surface-alt rounded-xl p-4">
              <p class="text-xs text-text-muted mb-1">今日解锁</p>
              <p class="text-2xl font-bold text-gold">{{ data.shareUnlockFunnel?.todayUnlocks || 0 }}</p>
            </div>
            <div class="bg-surface-alt rounded-xl p-4">
              <p class="text-xs text-text-muted mb-1">PDF 发送成功</p>
              <p class="text-2xl font-bold text-sage">{{ data.shareUnlockFunnel?.sentReports || 0 }}</p>
            </div>
            <div class="bg-surface-alt rounded-xl p-4">
              <p class="text-xs text-text-muted mb-1">发送成功率</p>
              <p class="text-2xl font-bold text-indigo">{{ data.shareUnlockFunnel?.unlocks ? Math.round((data.shareUnlockFunnel.sentReports / data.shareUnlockFunnel.unlocks) * 100) : 0 }}%</p>
            </div>
          </div>
          <div v-if="data.shareUnlockFunnel?.channels?.length" class="flex flex-wrap gap-2">
            <span v-for="item in data.shareUnlockFunnel.channels" :key="item.channel" class="px-3 py-1 bg-surface-alt rounded-full text-xs text-text-muted">
              {{ item.channel }}：{{ item.count }}
            </span>
          </div>
        </div>

        <!-- Overview Cards -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
          <div class="bg-white rounded-2xl p-5 shadow-sm border border-border/30">
            <p class="text-xs text-text-muted uppercase tracking-wider mb-2">今日测试</p>
            <p class="text-3xl font-display font-bold text-coral">{{ data.overview.todayTests }}</p>
            <p class="text-xs text-text-muted mt-1">本周 {{ data.overview.weekTests }} · 累计 {{ data.overview.totalTests }}</p>
          </div>
          <div class="bg-white rounded-2xl p-5 shadow-sm border border-border/30">
            <p class="text-xs text-text-muted uppercase tracking-wider mb-2">完测率</p>
            <p class="text-3xl font-display font-bold text-sage">{{ data.overview.completionRate }}%</p>
            <p class="text-xs text-text-muted mt-1">平均耗时 {{ formatSec(data.overview.avgDurationSec) }}</p>
          </div>
          <div class="bg-white rounded-2xl p-5 shadow-sm border border-border/30">
            <p class="text-xs text-text-muted uppercase tracking-wider mb-2">反馈数据</p>
            <p class="text-3xl font-display font-bold text-gold">{{ data.overview.totalFeedbacks }}</p>
            <p class="text-xs text-text-muted mt-1">累计相处偏好记录</p>
          </div>
          <div class="bg-white rounded-2xl p-5 shadow-sm border border-border/30">
            <p class="text-xs text-text-muted uppercase tracking-wider mb-2">邮箱收集</p>
            <p class="text-3xl font-display font-bold text-indigo">{{ data.overview.totalEmails }}</p>
            <p class="text-xs text-text-muted mt-1">今日新增 {{ data.overview.todayEmails }}</p>
          </div>
        </div>

        <!-- 7-Day Trend -->
        <div class="bg-white rounded-2xl p-6 shadow-sm border border-border/30 mb-6">
          <h2 class="text-sm font-semibold text-charcoal uppercase tracking-wider mb-4">📈 近7天测试趋势</h2>
          <div class="flex items-end gap-1 md:gap-3" style="height:140px">
            <div v-for="d in data.dailyTrend" :key="d.date" class="flex-1 flex flex-col items-center gap-1">
              <div class="w-full max-w-[48px] bg-coral/20 rounded-t-lg relative" :style="{ height: (d.count / Math.max(barMax(data.dailyTrend), 1)) * 120 + 'px' }">
                <div class="absolute inset-0 bg-coral/60 rounded-t-lg" :style="{ height: '100%' }" />
              </div>
              <span class="text-[10px] text-text-muted whitespace-nowrap">{{ d.date }}</span>
              <span class="text-[10px] font-bold text-coral">{{ d.count }}</span>
            </div>
          </div>
        </div>

        <!-- Referral Funnel -->
        <div class="bg-white rounded-2xl p-6 shadow-sm border border-border/30 mb-6">
          <h2 class="text-sm font-semibold text-charcoal uppercase tracking-wider mb-4">🎁 邀请免费解锁漏斗</h2>
          <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div class="bg-surface-alt rounded-xl p-4">
              <p class="text-xs text-text-muted mb-1">分享人数</p>
              <p class="text-2xl font-display font-bold text-charcoal">{{ data.referralFunnel.shares }}</p>
            </div>
            <div class="bg-surface-alt rounded-xl p-4">
              <p class="text-xs text-text-muted mb-1">被点击次数</p>
              <p class="text-2xl font-display font-bold text-coral">{{ data.referralFunnel.clicks }}</p>
            </div>
            <div class="bg-surface-alt rounded-xl p-4">
              <p class="text-xs text-text-muted mb-1">有效完成数</p>
              <p class="text-2xl font-display font-bold text-sage">{{ data.referralFunnel.validCompletions }}</p>
            </div>
            <div class="bg-surface-alt rounded-xl p-4">
              <p class="text-xs text-text-muted mb-1">奖励解锁数</p>
              <p class="text-2xl font-display font-bold text-gold">{{ data.referralFunnel.rewardUnlocks }}</p>
            </div>
            <div class="bg-surface-alt rounded-xl p-4">
              <p class="text-xs text-text-muted mb-1">邀请带来付费</p>
              <p class="text-2xl font-display font-bold text-charcoal">{{ data.referralFunnel.referredPaid }}</p>
            </div>
          </div>
        </div>

        <!-- Question Timing Stats -->
        <div v-if="data.questionTimingStats.length" class="bg-white rounded-2xl p-6 shadow-sm border border-border/30 mb-6">
          <h2 class="text-sm font-semibold text-charcoal uppercase tracking-wider mb-2">⏱️ 每题平均答题耗时 Top15</h2>
          <p class="text-xs text-text-muted mb-4">已过滤离开页面、切后台或单题超过 120 秒的异常值，用于判断题目是否卡住用户。</p>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-border text-left text-xs text-text-muted uppercase">
                  <th class="py-2 pr-3">题号</th>
                  <th class="py-2 pr-3">维度</th>
                  <th class="py-2 pr-3">类型</th>
                  <th class="py-2 pr-3">平均</th>
                  <th class="py-2 pr-3">中位</th>
                  <th class="py-2 pr-3">样本</th>
                  <th class="py-2">题目摘要</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border/30">
                <tr v-for="q in data.questionTimingStats" :key="q.questionId">
                  <td class="py-2 pr-3 font-bold text-charcoal">#{{ q.sortOrder || q.questionId }}</td>
                  <td class="py-2 pr-3 text-text-muted">{{ q.dimensionLabel || q.dimension }}</td>
                  <td class="py-2 pr-3 text-text-muted">{{ q.typeLabel || q.type }}</td>
                  <td class="py-2 pr-3 font-semibold text-coral">{{ formatShortSec(q.avgSec) }}</td>
                  <td class="py-2 pr-3 text-text-muted">{{ formatShortSec(q.medianSec) }}</td>
                  <td class="py-2 pr-3 text-text-muted">{{ q.samples }}</td>
                  <td class="py-2 text-text-muted max-w-md truncate">{{ q.label }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Two-column: Type Distribution + Feedback -->
        <div class="grid md:grid-cols-2 gap-6 mb-6">
          <!-- Type Distribution -->
          <div class="bg-white rounded-2xl p-6 shadow-sm border border-border/30">
            <h2 class="text-sm font-semibold text-charcoal uppercase tracking-wider mb-4">🏆 人格类型分布 Top15</h2>
            <div class="space-y-2">
              <div v-for="t in data.typeDistribution" :key="t.code" class="flex items-center gap-2">
                <span class="w-10 text-xs font-bold text-text-muted text-right shrink-0">{{ t.code }}</span>
                <div class="flex-1 h-5 bg-surface-alt rounded-full overflow-hidden">
                  <div class="h-full bg-coral/70 rounded-full flex items-center justify-end pr-2" :style="{ width: (t.count / barMax(data.typeDistribution)) * 100 + '%' }">
                    <span class="text-[10px] text-white font-bold">{{ t.count }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Feedback Stats -->
          <div class="bg-white rounded-2xl p-6 shadow-sm border border-border/30">
            <h2 class="text-sm font-semibold text-charcoal uppercase tracking-wider mb-4">💬 相处偏好 Top10</h2>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <p class="text-xs text-sage font-semibold mb-2">😊 最受欢迎</p>
                <div class="space-y-1.5">
                  <div v-for="l in data.topLiked" :key="l.type" class="flex items-center gap-2 text-xs">
                    <span class="w-8 font-bold text-sage">{{ l.type }}</span>
                    <div class="flex-1 h-3 bg-sage/10 rounded-full overflow-hidden">
                      <div class="h-full bg-sage/60 rounded-full" :style="{ width: (l.count / barMax(data.topLiked)) * 100 + '%' }" />
                    </div>
                    <span class="text-text-muted w-5 text-right">{{ l.count }}</span>
                  </div>
                </div>
              </div>
              <div>
                <p class="text-xs text-coral font-semibold mb-2">😣 最难相处</p>
                <div class="space-y-1.5">
                  <div v-for="d in data.topDisliked" :key="d.type" class="flex items-center gap-2 text-xs">
                    <span class="w-8 font-bold text-coral">{{ d.type }}</span>
                    <div class="flex-1 h-3 bg-coral/10 rounded-full overflow-hidden">
                      <div class="h-full bg-coral/60 rounded-full" :style="{ width: (d.count / barMax(data.topDisliked)) * 100 + '%' }" />
                    </div>
                    <span class="text-text-muted w-5 text-right">{{ d.count }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Traffic Sources -->
        <div v-if="data.utmSources.length" class="bg-white rounded-2xl p-6 shadow-sm border border-border/30 mb-6">
          <h2 class="text-sm font-semibold text-charcoal uppercase tracking-wider mb-4">🔗 流量来源</h2>
          <div class="flex flex-wrap gap-3">
            <div v-for="u in data.utmSources" :key="u.source" class="px-4 py-2 bg-surface-alt rounded-xl text-sm">
              <span class="font-semibold text-charcoal">{{ sourceLabel(u.source) }}</span>
              <span class="text-text-muted ml-2">{{ u.count }} 次</span>
            </div>
          </div>
        </div>

        <!-- Email List (toggleable) -->
        <div v-if="showEmails" class="bg-white rounded-2xl p-6 shadow-sm border border-border/30">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-sm font-semibold text-charcoal uppercase tracking-wider">📧 邮箱列表 ({{ emails.length }})</h2>
            <button @click="copyEmails" class="text-xs text-coral hover:underline">复制全部</button>
          </div>
          <div v-if="!emails.length" class="text-text-muted text-sm text-center py-8">暂无邮箱数据</div>
          <div v-else class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-border text-left text-xs text-text-muted uppercase">
                  <th class="py-2 pr-4">邮箱</th>
                  <th class="py-2 pr-4">人格类型</th>
                  <th class="py-2 pr-4">来源</th>
                  <th class="py-2">时间</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border/30">
                <tr v-for="e in emails.slice(0, 100)" :key="e.email">
                  <td class="py-2 pr-4 font-medium text-charcoal">{{ e.email }}</td>
                  <td class="py-2 pr-4 text-text-muted">{{ e.typeCode || '-' }}</td>
                  <td class="py-2 pr-4">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="e.source === 'paywall' ? 'bg-gold/10 text-gold' : 'bg-sage/10 text-sage'">{{ emailSourceLabel(e.source) }}</span>
                  </td>
                  <td class="py-2 text-text-muted text-xs">{{ new Date(e.createdAt).toLocaleDateString('zh-CN') }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
