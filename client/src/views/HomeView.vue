<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../services/api'
import { clearAccessToken, getAccessToken, redeemAccessCode, resumeDeviceUnlock } from '../services/access'
import { IS_DEMO } from '../services/demoMode'
import AccessGate from '../components/AccessGate.vue'

const router = useRouter()
const showAccessGate = ref(false)
const accessError = ref('')

const dimensions = [
  { index: '01', label: '能量来源', left: 'E', mid: 'A', right: 'I', note: '外向 / 平衡 / 内向' },
  { index: '02', label: '认知方式', left: 'S', mid: 'B', right: 'N', note: '实感 / 均衡 / 直觉' },
  { index: '03', label: '决策方式', left: 'T', mid: 'C', right: 'F', note: '思考 / 复合 / 情感' },
  { index: '04', label: '生活态度', left: 'J', mid: 'D', right: 'P', note: '判断 / 动态 / 感知' },
]

onMounted(async () => {
  window.scrollTo({ top: 0, behavior: 'instant' })
  const params = new URLSearchParams(window.location.search)
  // 卖家自查入口：/?reset=1 清除本机解锁令牌，恢复"需输码"状态（不影响兑换码额度，重输码即可再解锁）
  if (params.get('reset') === '1') {
    clearAccessToken()
  }
  const referralCode = params.get('ref')
  if (referralCode) {
    localStorage.setItem('mbti-pro-referral-code', referralCode)
    api.trackReferralClick(referralCode).catch(() => {})
  }

  // 小红书 AI 客服可直接发送 https://mbti-pro.com/?code=XXXX 实现一键解锁
  const accessCode = params.get('code') || params.get('access')
  if (accessCode && !IS_DEMO) {
    if (getAccessToken()) {
      router.replace('/test')
      return
    }
    // 本机曾兑换过：静默恢复会话解锁，不重复消耗兑换码额度
    if (await resumeDeviceUnlock()) {
      router.replace('/test')
      return
    }
    try {
      await redeemAccessCode(accessCode)
      router.replace('/test')
      return
    } catch (err) {
      accessError.value = err instanceof Error ? err.message : '兑换码无效，请重新输入。'
      showAccessGate.value = true
    }
  }
})

function startTest() {
  accessError.value = ''
  if (IS_DEMO || getAccessToken()) {
    router.push('/test')
    return
  }
  showAccessGate.value = true
}

function onAccessUnlocked() {
  showAccessGate.value = false
  router.push('/test')
}
</script>

<template>
  <div class="home-page">
    <header class="site-header">
      <button class="brand" type="button" @click="router.push('/')">
        <span class="brand-mark">MBTI</span>
        <span class="brand-dash">—</span>
        <span class="brand-mark">PRO</span>
      </button>
      <p class="header-caption">81-TYPE PERSONALITY ARCHIVE</p>
      <button type="button" class="header-action" @click="startTest">
        开始测试
        <span aria-hidden="true">↗</span>
      </button>
    </header>

    <main>
      <section class="hero">
        <div class="hero-copy">
          <p class="eyebrow"><span>ARCHIVE 001</span><span>荣格类型学 · 81 型</span></p>
          <h1>
            你不是不够外向。<br />
            <em>你只是卡在中间。</em>
          </h1>
          <p class="hero-lede">
            16 型让你在两端选一个。81 型承认中间也有位置。<br />
            40 道情境题，给你一张能解释自己的坐标图。
          </p>
          <div class="hero-actions">
            <button type="button" class="primary-action" @click="startTest">
              开始 40 题测试
              <span aria-hidden="true">→</span>
            </button>
            <span class="action-note">6–8 分钟 · 可中断续答</span>
          </div>
          <p class="price-note">小红书店铺 0.99 元 · 一次兑换解锁全部内容</p>
        </div>

        <aside class="coordinate" aria-label="MBTI-PRO 四维坐标">
          <div class="coordinate-head">
            <span>YOUR COORDINATE</span>
            <span>81 TYPES</span>
          </div>
          <div class="coordinate-body">
            <div v-for="dim in dimensions" :key="dim.index" class="axis-row">
              <span class="axis-index">{{ dim.index }}</span>
              <div class="axis-main">
                <div class="axis-label">
                  <span>{{ dim.label }}</span>
                  <span>{{ dim.note }}</span>
                </div>
                <div class="axis-line">
                  <b>{{ dim.left }}</b>
                  <i />
                  <b class="axis-mid">{{ dim.mid }}</b>
                  <i />
                  <b>{{ dim.right }}</b>
                </div>
              </div>
            </div>
          </div>
          <div class="coordinate-foot">
            <span>不是二选一</span>
            <span>3 × 3 × 3 × 3</span>
          </div>
        </aside>
      </section>

      <section class="section section-gap">
        <div class="section-kicker"><span>01</span><span>THE GAP</span></div>
        <div class="section-grid">
          <h2>16 型，<br /><em>漏掉了中间的人。</em></h2>
          <div class="prose">
            <p>你可能在聚会上很自在，回家却需要一整晚恢复。</p>
            <p>你可能既讲逻辑，也会在深夜被一句话击中。</p>
            <p>传统测试要求你选一边；81 型把中间也当作答案。</p>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="section-kicker"><span>02</span><span>THE SYSTEM</span></div>
        <div class="section-grid section-grid--system">
          <h2>四个维度，<br /><em>每个都有第三个位置。</em></h2>
          <div class="formula">
            <span>3</span><i>×</i><span>3</span><i>×</i><span>3</span><i>×</i><span>3</span><b>= 81</b>
          </div>
        </div>
        <div class="dimension-list">
          <div v-for="dim in dimensions" :key="dim.index" class="dimension-row">
            <span class="dimension-index">{{ dim.index }}</span>
            <span class="dimension-name">{{ dim.label }}</span>
            <span class="dimension-code">{{ dim.left }} <i>/</i> {{ dim.mid }} <i>/</i> {{ dim.right }}</span>
            <span class="dimension-note">{{ dim.note }}</span>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="section-kicker"><span>03</span><span>THE TEST</span></div>
        <div class="section-grid">
          <h2>40 道题，<br /><em>把模糊的部分问清楚。</em></h2>
          <div class="prose">
            <p>不是 100 道题的疲劳战，也不是一分钟的娱乐标签。</p>
            <p>每道题都在问一个具体情境：你会怎么选，而不是你“应该”怎么选。</p>
            <p>完成后你会得到主类型、相邻候选，以及四个维度的连续坐标。</p>
          </div>
        </div>
        <div class="test-facts">
          <div class="fact"><strong>40</strong><span>道情境题</span></div>
          <div class="fact"><strong>6–8</strong><span>分钟完成</span></div>
          <div class="fact"><strong>81</strong><span>种人格坐标</span></div>
          <div class="fact"><strong>0.99</strong><span>元解锁全部</span></div>
        </div>
      </section>

    </main>

    <footer class="site-footer">
      <span>MBTI-PRO / 81-TYPE PERSONALITY ARCHIVE</span>
      <nav class="site-footer-links">
        <RouterLink to="/privacy">隐私政策</RouterLink>
        <RouterLink to="/terms">用户协议</RouterLink>
        <RouterLink to="/refund">退款说明</RouterLink>
        <RouterLink to="/contact">联系我们</RouterLink>
      </nav>
      <span>结果仅供自我探索，不用于临床诊断或招聘决策</span>
    </footer>

    <Transition name="modal">
      <div v-if="showAccessGate" class="gate-overlay">
        <div class="gate-backdrop" @click="showAccessGate = false" />
        <div class="gate-dialog">
          <button type="button" class="gate-close" aria-label="关闭" @click="showAccessGate = false">×</button>
          <AccessGate
            :description="accessError
              ? `${accessError} 请检查兑换码后重试。`
              : '在小红书店铺购买 0.99 元商品后，复制订单里的兑换码。一次兑换，40 题测试与完整报告全部解锁。'"
            @unlocked="onAccessUnlocked"
          />
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.home-page {
  --paper: #f2ede3;
  --paper-light: #f8f4ec;
  --ink: #1e1d1a;
  --muted: #6f685d;
  --rule: #d2c8b8;
  --accent: #a63d2c;
  min-height: 100vh;
  background: var(--paper);
  color: var(--ink);
  font-family: "PingFang SC", "HarmonyOS Sans SC", "Microsoft YaHei", "Noto Sans CJK SC", "Source Han Sans SC", system-ui, sans-serif;
  overflow: hidden;
}

.site-header {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 24px;
  max-width: 1380px;
  margin: 0 auto;
  padding: 22px 40px;
  border-bottom: 1px solid var(--rule);
}

.brand {
  justify-self: start;
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  background: none;
  color: var(--ink);
  font-family: "DM Mono", "SF Mono", Consolas, "Roboto Mono", monospace;
  font-size: 15px;
  letter-spacing: .08em;
}

.brand-dash { color: var(--accent); }
.brand-mark { font-weight: 500; }

.header-caption {
  margin: 0;
  color: var(--muted);
  font-family: "DM Mono", "SF Mono", Consolas, "Roboto Mono", monospace;
  font-size: 10px;
  letter-spacing: .12em;
  white-space: nowrap;
}

.header-action {
  justify-self: end;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  background: none;
  color: var(--ink);
  font-size: 13px;
  font-weight: 600;
  padding: 8px 0;
  border-bottom: 1px solid var(--ink);
}

.header-action span { color: var(--accent); font-size: 16px; }

.hero {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(360px, .85fr);
  gap: clamp(40px, 8vw, 140px);
  align-items: center;
  max-width: 1380px;
  min-height: 650px;
  margin: 0 auto;
  padding: 100px 40px 110px;
}

.hero-copy { max-width: 760px; }

.eyebrow {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  margin: 0 0 30px;
  color: var(--muted);
  font-family: "DM Mono", "SF Mono", Consolas, "Roboto Mono", monospace;
  font-size: 10px;
  letter-spacing: .12em;
  text-transform: uppercase;
}

.eyebrow span:first-child { color: var(--accent); }

h1, h2 {
  margin: 0;
  font-family: "Playfair Display", "Songti SC", "STSong", SimSun, "Noto Serif CJK SC", "Source Han Serif SC", serif;
  font-weight: 600;
  letter-spacing: -.055em;
  text-wrap: balance;
}

h1 {
  font-size: clamp(48px, 6.2vw, 94px);
  line-height: 1.1;
}

h1 em, h2 em {
  color: var(--accent);
  font-style: normal;
}

.hero-lede {
  max-width: 570px;
  margin: 32px 0 0;
  color: var(--muted);
  font-size: 16px;
  line-height: 1.95;
}

.hero-actions {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-top: 36px;
}

.primary-action {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 32px;
  min-width: 210px;
  padding: 16px 20px;
  border: 1px solid var(--ink);
  border-radius: 2px;
  background: var(--ink);
  color: var(--paper-light);
  font-size: 14px;
  font-weight: 600;
  transition: transform .2s ease, background .2s ease;
}

.primary-action:hover { background: var(--accent); border-color: var(--accent); transform: translateY(-2px); }
.primary-action span { font-size: 18px; font-weight: 400; }
.action-note { color: var(--muted); font-family: "DM Mono", "SF Mono", Consolas, "Roboto Mono", monospace; font-size: 11px; }
.price-note { margin: 18px 0 0; color: var(--muted); font-size: 12px; }

.coordinate {
  align-self: stretch;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 430px;
  padding: 24px 0 18px;
  border-top: 1px solid var(--ink);
  border-bottom: 1px solid var(--rule);
}

.coordinate-head, .coordinate-foot {
  display: flex;
  justify-content: space-between;
  color: var(--muted);
  font-family: "DM Mono", "SF Mono", Consolas, "Roboto Mono", monospace;
  font-size: 10px;
  letter-spacing: .1em;
}

.coordinate-body { padding: 30px 0; }
.axis-row { display: grid; grid-template-columns: 30px 1fr; gap: 12px; padding: 16px 0; border-top: 1px solid var(--rule); }
.axis-row:first-child { border-top: 0; }
.axis-index { color: var(--accent); font-family: "DM Mono", "SF Mono", Consolas, "Roboto Mono", monospace; font-size: 11px; }
.axis-label { display: flex; justify-content: space-between; margin-bottom: 14px; font-size: 12px; }
.axis-label span:last-child { color: var(--muted); font-size: 11px; }
.axis-line { display: flex; align-items: center; gap: 8px; color: var(--ink); font-family: "DM Mono", "SF Mono", Consolas, "Roboto Mono", monospace; font-size: 18px; }
.axis-line i { flex: 1; height: 1px; background: var(--rule); }
.axis-line b { font-weight: 500; }
.axis-line .axis-mid { color: var(--accent); font-size: 15px; }
.coordinate-foot span:last-child { color: var(--ink); }

.section {
  max-width: 1380px;
  margin: 0 auto;
  padding: 72px 40px;
  border-top: 1px solid var(--rule);
}
.section-gap { padding-top: 96px; }
.section-kicker {
  display: flex;
  gap: 18px;
  margin-bottom: 34px;
  color: var(--muted);
  font-family: "DM Mono", "SF Mono", Consolas, "Roboto Mono", monospace;
  font-size: 10px;
  letter-spacing: .1em;
}
.section-kicker span:first-child { color: var(--accent); }
.section-grid { display: grid; grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr); gap: clamp(40px, 9vw, 140px); align-items: start; }
h2 { font-size: clamp(36px, 4.4vw, 64px); line-height: 1.18; }
.prose { max-width: 570px; padding-top: 8px; }
.prose p { margin: 0 0 18px; color: var(--muted); font-size: 16px; line-height: 1.95; }
.prose p:last-child { margin-bottom: 0; color: var(--ink); }
.section-grid--system { align-items: end; }
.formula { display: flex; align-items: baseline; justify-content: flex-end; gap: 14px; padding-bottom: 6px; font-family: "DM Mono", "SF Mono", Consolas, "Roboto Mono", monospace; }
.formula span { font-size: clamp(34px, 4vw, 56px); font-weight: 400; }
.formula i { color: var(--muted); font-size: 24px; font-style: normal; }
.formula b { margin-left: 8px; color: var(--accent); font-size: 22px; font-weight: 400; white-space: nowrap; }
.dimension-list { margin-top: 56px; border-top: 1px solid var(--ink); }
.dimension-row { display: grid; grid-template-columns: 44px 1.1fr 1fr 1.2fr; gap: 20px; align-items: center; padding: 20px 0; border-bottom: 1px solid var(--rule); font-size: 13px; }
.dimension-index { color: var(--accent); font-family: "DM Mono", "SF Mono", Consolas, "Roboto Mono", monospace; font-size: 11px; }
.dimension-name { font-family: "Playfair Display", "Songti SC", "STSong", SimSun, "Noto Serif CJK SC", "Source Han Serif SC", serif; font-size: 18px; font-weight: 600; }
.dimension-code { font-family: "DM Mono", "SF Mono", Consolas, "Roboto Mono", monospace; font-size: 15px; }
.dimension-code i { color: var(--muted); font-style: normal; }
.dimension-note { color: var(--muted); text-align: right; font-size: 12px; }

.test-facts { display: grid; grid-template-columns: repeat(4, 1fr); margin-top: 58px; border-top: 1px solid var(--ink); border-bottom: 1px solid var(--rule); }
.fact { display: flex; flex-direction: column; gap: 8px; padding: 22px 22px 24px 0; border-right: 1px solid var(--rule); }
.fact + .fact { padding-left: 22px; }
.fact:last-child { border-right: 0; }
.fact strong { font-family: "Playfair Display", "Songti SC", "STSong", SimSun, "Noto Serif CJK SC", "Source Han Serif SC", serif; font-size: 34px; font-weight: 600; }
.fact span { color: var(--muted); font-size: 12px; }

.site-footer { display: flex; justify-content: space-between; gap: 24px; max-width: 1380px; margin: 0 auto; padding: 22px 40px 30px; color: var(--muted); font-family: "DM Mono", "SF Mono", Consolas, "Roboto Mono", monospace; font-size: 10px; letter-spacing: .04em; }
.site-footer-links { display: flex; flex-wrap: wrap; gap: 8px 20px; }
.site-footer-links a { color: var(--muted); text-decoration: none; border-bottom: 1px solid transparent; }
.site-footer-links a:hover { color: var(--accent); border-bottom-color: var(--accent); }

.gate-overlay { position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; padding: 16px; }
.gate-backdrop { position: absolute; inset: 0; background: rgba(30, 29, 26, .55); backdrop-filter: blur(4px); }
.gate-dialog { position: relative; width: 100%; max-width: 560px; }
.gate-close { position: absolute; top: -12px; right: 8px; z-index: 2; display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; border: 1px solid var(--rule); border-radius: 50%; background: var(--paper-light); color: var(--ink); font-size: 22px; line-height: 1; }

.modal-enter-active, .modal-leave-active { transition: opacity .25s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }

@media (max-width: 900px) {
  .site-header { grid-template-columns: 1fr auto; padding: 18px 22px; }
  .header-caption { display: none; }
  .hero { grid-template-columns: 1fr; gap: 54px; min-height: 0; padding: 64px 22px 72px; }
  .coordinate { min-height: 360px; }
  .section { padding: 64px 22px; }
  .section-gap { padding-top: 72px; }
  .section-grid { grid-template-columns: 1fr; gap: 26px; }
  .section-grid--system { align-items: start; }
  .formula { justify-content: flex-start; }
  .dimension-row { grid-template-columns: 32px 1fr auto; gap: 12px; }
  .dimension-note { display: none; }
  .test-facts { grid-template-columns: repeat(2, 1fr); }
  .fact:nth-child(2) { border-right: 0; }
  .fact:nth-child(n+3) { border-top: 1px solid var(--rule); }
  .site-footer { padding: 20px 22px 26px; flex-direction: column; gap: 8px; }
}

@media (max-width: 480px) {
  h1 { font-size: 43px; }
  h2 { font-size: 34px; }
  .eyebrow { font-size: 9px; }
  .hero-lede { font-size: 15px; }
  .hero-actions { align-items: flex-start; flex-direction: column; gap: 12px; }
  .primary-action { width: 100%; }
  .test-facts { margin-top: 42px; }
  .fact { padding: 18px 12px 20px 0; }
  .fact strong { font-size: 28px; }
}

@media (prefers-reduced-motion: reduce) {
  .primary-action { transition: none; }
}
</style>
