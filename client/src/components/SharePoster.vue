<script setup lang="ts">
import { ref, onMounted } from 'vue'
import QRCode from 'qrcode'
import { api } from '../services/api'

const props = defineProps<{
  typeCode: string; typeName: string
  typeColor: { hex: string; name: string }; groupColor: { hex: string; name: string }
  oneLiner: string; imageUrl: string
  recordId?: string
  scores?: { E_I: number; S_N: number; T_F: number; P_J: number }
  chars?: { E_I: string; S_N: string; T_F: string; P_J: string }
}>()
const emit = defineEmits<{ close: [] }>()
const qrDataUrl = ref(''); const generatedImageUrl = ref(''); const isGenerating = ref(true)
const showModal = ref(false); const hasError = ref(false)

const W = 800
const DIM_COLORS: Record<string, string> = {
  I: '#3D6FFF', E: '#FF5722', N: '#6A1B9A', S: '#00796B',
  F: '#0277BD', T: '#E65100', P: '#BF8C00', J: '#1565C0',
}

async function getShareUrl() {
  const email = localStorage.getItem('mbti-pro-referral-email') || ''
  if (props.recordId && email) {
    try {
      const reward = await api.createReferral(props.recordId, props.typeCode, email)
      return `${location.origin}/test?ref=${reward.code}`
    } catch { /* fallback below */ }
  }
  return `${location.origin}/test?utm_source=share_poster&utm_medium=poster&utm_campaign=${props.typeCode}`
}

async function generateQR() {
  try { qrDataUrl.value = await QRCode.toDataURL(await getShareUrl(), { width: 110, margin: 0, color: { dark: '#1A1A1A', light: '#FFFFFF' } }) } catch {}
}
function loadImage(s: string): Promise<HTMLImageElement> { return new Promise((rs, rj) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => rs(i); i.onerror = rj; i.src = s }) }
function rRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r); ctx.closePath()
}

async function drawPoster() {
  const hasScores = !!(props.scores && props.chars)
  const imgSz = 480
  let h = 42 + 30 + imgSz + 28 + 82 + 46 // top + brand + image + code + name
  if (hasScores) h += 4 * 64 + 32 // 维度条
  h += 28 + 100 + 24 // divider + QR + footer
  const H = Math.max(h, 920)

  const cvs = document.createElement('canvas'); cvs.width = W * 2; cvs.height = H * 2
  const ctx = cvs.getContext('2d')!; ctx.scale(2, 2)

  // 米白背景
  ctx.fillStyle = '#FAF8F5'; ctx.fillRect(0, 0, W, H)

  // 顶部色条 + 更大渐变光晕
  ctx.fillStyle = props.typeColor.hex; ctx.fillRect(0, 0, W, 5)
  const tg = ctx.createLinearGradient(0, 5, 0, 140); tg.addColorStop(0, props.typeColor.hex + '12'); tg.addColorStop(1, 'transparent')
  ctx.fillStyle = tg; ctx.fillRect(0, 5, W, 140)

  let y = 42
  // 品牌文字更大
  ctx.font = '600 13px "Noto Sans SC"'; ctx.fillStyle = '#B5ADA4'; ctx.textAlign = 'center'; ctx.letterSpacing = '0.12em' as any
  ctx.fillText('MBTI-PRO · 81 型人格深度测试', W / 2, y); y += 30

  // 圆形人格图片 — 480px 更大更突出
  try {
    const avatar = await loadImage(`/api/images/${props.typeCode}`)
    // 阴影更柔和
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.10)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 6
    ctx.beginPath(); ctx.arc(W / 2, y + imgSz / 2, imgSz / 2, 0, Math.PI * 2)
    ctx.fillStyle = '#fff'; ctx.fill()
    ctx.restore()
    ctx.save()
    ctx.beginPath(); ctx.arc(W / 2, y + imgSz / 2, imgSz / 2, 0, Math.PI * 2); ctx.clip()
    ctx.drawImage(avatar, W / 2 - imgSz / 2, y, imgSz, imgSz)
    ctx.restore()
    y += imgSz + 28
  } catch { y += 16 }

  // 类型代码 — 加大
  ctx.font = '900 86px "Playfair Display", serif'; ctx.fillStyle = props.typeColor.hex
  ctx.fillText(props.typeCode, W / 2, y + 68); y += 82

  // 类型名称 — 加大
  ctx.font = '700 28px "Noto Sans SC"'; ctx.fillStyle = '#2D2D2D'
  ctx.fillText(props.typeName.replace('型', ''), W / 2, y + 24); y += 46

  // 四维状态条
  if (hasScores) {
    const dims = [
      { key: 'E_I' as const, left: 'I', right: 'E' },
      { key: 'S_N' as const, left: 'N', right: 'S' },
      { key: 'T_F' as const, left: 'F', right: 'T' },
      { key: 'P_J' as const, left: 'P', right: 'J' },
    ]
    const barW = 580; const barH = 28; const barX = (W - barW) / 2; const dimGap = 64

    dims.forEach((dim, i) => {
      const dy = y + i * dimGap; const score = props.scores![dim.key]
      const pos = Math.max(3, Math.min(97, 50 + (score / 50) * 47))
      const lc = DIM_COLORS[dim.left]; const rc = DIM_COLORS[dim.right]

      ctx.font = 'bold 18px "Noto Sans SC"'
      ctx.textAlign = 'left'; ctx.fillStyle = lc; ctx.fillText(dim.left, barX - 56, dy + barH / 2 + 6)
      ctx.textAlign = 'right'; ctx.fillStyle = rc; ctx.fillText(dim.right, barX + barW + 56, dy + barH / 2 + 6)

      ctx.fillStyle = '#EAE7E0'; rRect(ctx, barX, dy, barW, barH, barH / 2); ctx.fill()
      ctx.fillStyle = '#D4D0C8'; ctx.fillRect(barX + barW / 2 - 1.5, dy, 3, barH)
      const lg = ctx.createLinearGradient(barX, 0, barX + barW / 2, 0); lg.addColorStop(0, lc + '45'); lg.addColorStop(1, '#EAE7E0')
      ctx.fillStyle = lg; ctx.fillRect(barX, dy, barW / 2, barH)
      const rg = ctx.createLinearGradient(barX + barW / 2, 0, barX + barW, 0); rg.addColorStop(0, '#EAE7E0'); rg.addColorStop(1, rc + '45')
      ctx.fillStyle = rg; ctx.fillRect(barX + barW / 2, dy, barW / 2, barH)

      const dotX = barX + (barW * pos) / 100; const dotY = dy + barH / 2; const dotR = 11
      ctx.beginPath(); ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2)
      ctx.fillStyle = pos >= 50 ? rc : lc; ctx.fill()
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.stroke()

      ctx.font = 'bold 11px "DM Mono", monospace'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'
      ctx.fillText(score > 0 ? `+${score}` : `${score}`, dotX, dotY + 4)
    })
    y += dims.length * dimGap + 32
  }

  // 分隔线
  ctx.strokeStyle = '#E0D8CC'; ctx.lineWidth = 1; ctx.beginPath()
  ctx.moveTo((W - 120) / 2, y); ctx.lineTo((W + 120) / 2, y); ctx.stroke()
  y += 24

  // 底部：左文字 + 二维码
  const qrS = 96; const qrX = W - qrS - 56
  ctx.textAlign = 'left'
  ctx.font = '700 16px "Noto Sans SC"'; ctx.fillStyle = '#2D2D2D'
  ctx.fillText('扫码测测你的人格类型', 56, y + 18)
  ctx.font = '400 12px "Noto Sans SC"'; ctx.fillStyle = '#9C958E'
  ctx.fillText('发现你的 81 型专属人格画像', 56, y + 38)

  try {
    const qrImg = await loadImage(qrDataUrl.value)
    rRect(ctx, qrX - 4, y - 4, qrS + 8, qrS + 8, 10)
    ctx.fillStyle = '#fff'; ctx.fill()
    ctx.drawImage(qrImg, qrX, y, qrS, qrS)
  } catch {}
  y += qrS + 16

  // 免责
  ctx.textAlign = 'center'; ctx.font = '400 10px "Noto Sans SC"'; ctx.fillStyle = '#B0A89E'
  ctx.fillText('测试结果仅供个人参考，不构成任何临床诊断依据', W / 2, y + 6)

  generatedImageUrl.value = cvs.toDataURL('image/jpeg', 0.92)
}

onMounted(async () => {
  await generateQR()
  try { await drawPoster() } catch { hasError.value = true }
  finally { isGenerating.value = false; showModal.value = true }
})

const isMobile = ref(false)
const showLongPressHint = ref(false)

function downloadPoster() {
  if (!generatedImageUrl.value) return
  // 移动端：无法通过JS触发下载，显示长按提示
  if (isMobile.value) {
    showLongPressHint.value = true
    setTimeout(() => { showLongPressHint.value = false }, 4000)
    return
  }
  // 桌面端：正常下载
  const a = document.createElement('a')
  a.href = generatedImageUrl.value
  a.download = `MBTI-PRO-${props.typeCode}.jpg`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

async function sharePoster() {
  if (!generatedImageUrl.value) return
  // 尝试 Web Share API (支持图片分享的移动浏览器)
  if (navigator.share && navigator.canShare) {
    try {
      const blob = await (await fetch(generatedImageUrl.value)).blob()
      const file = new File([blob], `MBTI-PRO-${props.typeCode}.jpg`, { type: 'image/jpeg' })
      const shareData: any = { files: [file], title: 'MBTI-PRO 人格画像' }
      if (navigator.canShare(shareData)) {
        await navigator.share(shareData)
        return
      }
    } catch { /* fallback */ }
  }
  // 降级：显示长按提示
  downloadPoster()
}

onMounted(async () => {
  // 检测移动端
  isMobile.value = /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent) || ('ontouchstart' in window && window.innerWidth < 768)
  await generateQR()
  try { await drawPoster() } catch { hasError.value = true }
  finally { isGenerating.value = false; showModal.value = true }
})
</script>

<template>
  <Transition name="modal">
    <div v-if="isGenerating" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-charcoal/40 backdrop-blur-sm" />
      <div class="relative bg-cream rounded-3xl p-10 flex flex-col items-center shadow-2xl">
        <div class="w-10 h-10 rounded-full border-4 border-coral-soft border-t-coral animate-spin mb-4" />
        <p class="text-sm text-text-secondary">正在生成分享海报...</p>
      </div>
    </div>
  </Transition>
  <Transition name="modal">
    <div v-if="showModal && !isGenerating && !hasError" class="fixed inset-0 z-50 flex items-center justify-center p-5">
      <div class="absolute inset-0 bg-charcoal/50 backdrop-blur-sm" @click="emit('close')" />
      <div class="relative bg-cream rounded-3xl p-6 max-w-sm w-full shadow-2xl">
        <h3 class="text-lg font-bold text-charcoal mb-2 text-center">分享你的人格画像</h3>
        <p v-if="isMobile" class="text-sm text-text-muted text-center mb-5">长按下方图片即可保存到相册</p>
        <p v-else class="text-sm text-text-muted text-center mb-5">点击保存图片，分享到朋友圈</p>
        <div class="rounded-2xl overflow-hidden mb-5 relative" style="box-shadow:0 8px 32px rgba(0,0,0,.1)">
          <img :src="generatedImageUrl" class="w-full" />
          <!-- 长按提示浮层 -->
          <Transition name="fade">
            <div v-if="showLongPressHint" class="absolute inset-0 bg-charcoal/80 flex items-center justify-center rounded-2xl">
              <div class="text-center text-cream px-6">
                <p class="text-5xl mb-3">👆</p>
                <p class="text-lg font-bold mb-1">长按图片</p>
                <p class="text-sm opacity-80">选择「保存图片」即可存到相册</p>
              </div>
            </div>
          </Transition>
        </div>
        <div class="flex gap-3">
          <button @click="emit('close')" class="flex-1 px-4 py-3 text-sm font-medium text-text-secondary border border-border rounded-xl">关闭</button>
          <!-- 移动端：分享按钮（调用系统分享） -->
          <button v-if="isMobile" @click="sharePoster" class="flex-1 px-4 py-3 text-sm font-semibold text-white rounded-xl" :style="{background:typeColor.hex}">📤 分享给朋友</button>
          <!-- 桌面端：保存按钮 -->
          <button v-else @click="downloadPoster" class="flex-1 px-4 py-3 text-sm font-semibold bg-charcoal text-cream rounded-xl">保存图片</button>
          <button v-if="!isMobile" @click="sharePoster" class="flex-1 px-4 py-3 text-sm font-semibold text-white rounded-xl" :style="{background:typeColor.hex}">📤 分享</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-enter-active,.modal-leave-active{transition:all .3s ease}
.modal-enter-from,.modal-leave-to{opacity:0}
.fade-enter-active,.fade-leave-active{transition:all .25s ease}
.fade-enter-from,.fade-leave-to{opacity:0}
</style>
