<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import QRCode from 'qrcode'

const props = defineProps<{
  typeCode: string
  typeName: string
  typeColor: { hex: string; name: string }
  groupColor: { hex: string; name: string }
  oneLiner: string
  imageUrl: string
  scores?: { E_I: number; S_N: number; T_F: number; P_J: number }
  chars?: { E_I: string; S_N: string; T_F: string; P_J: string }
}>()

const emit = defineEmits<{ close: [] }>()

const qrDataUrl = ref('')
const generatedImageUrl = ref('')
const isGenerating = ref(true)
const showModal = ref(false)
const hasError = ref(false)

const W = 750
const H = 1334

// 高对比度维度颜色 — 确保在任何背景上都清晰可见
const DIM_COLORS: Record<string, string> = {
  I: '#3D6FFF', E: '#FF5722',
  N: '#6A1B9A', S: '#00796B',
  F: '#0277BD', T: '#E65100',
  P: '#BF8C00', J: '#1565C0',
}

async function generateQR() {
  try {
    const baseUrl = window.location.origin
    qrDataUrl.value = await QRCode.toDataURL(`${baseUrl}/#/test?ref=share`, {
      width: 160, margin: 1,
      color: { dark: '#1A1A1A', light: '#FFFFFF' },
    })
  } catch {}
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image load failed'))
    img.src = src
  })
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r); ctx.closePath()
}

async function drawPoster() {
  const canvas = document.createElement('canvas')
  canvas.width = W * 2; canvas.height = H * 2
  const ctx = canvas.getContext('2d')!
  ctx.scale(2, 2)

  // 1. 纯白底色 + 深邃装饰
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, W, H)

  // 2. 顶部深色区域（深灰渐变）
  const headerH = 420
  const headerGrad = ctx.createLinearGradient(0, 0, 0, headerH)
  headerGrad.addColorStop(0, '#1A1A2E')
  headerGrad.addColorStop(1, '#2D2D44')
  ctx.fillStyle = headerGrad
  ctx.fillRect(0, 0, W, headerH)

  // 3. 类型色装饰弧线
  ctx.beginPath()
  ctx.arc(W / 2, headerH, 380, Math.PI, 0)
  ctx.fillStyle = props.typeColor.hex + '12'; ctx.fill()

  let y = 62

  // 4. Brand（顶部导航栏区域）
  ctx.font = 'bold 13px "Noto Sans SC", sans-serif'
  ctx.fillStyle = '#FFFFFF60'; ctx.textAlign = 'center'
  ctx.fillText('MBTI PRO', W / 2, y); y += 22
  ctx.font = '10px "Noto Sans SC", sans-serif'
  ctx.fillStyle = '#FFFFFF30'
  ctx.fillText('81 型人格深度测试', W / 2, y); y += 36

  // 5. AI 人格图片（圆形容器，高清原图）
  try {
    const imgUrl = `/api/images/${props.typeCode}`
    const avatar = await loadImage(imgUrl)
    const imgSize = 280; const imgX = (W - imgSize) / 2
    ctx.save()
    ctx.beginPath()
    ctx.arc(W / 2, y + imgSize / 2, imgSize / 2 + 4, 0, Math.PI * 2)
    ctx.fillStyle = '#FFFFFF18'; ctx.fill()
    ctx.restore()
    ctx.save()
    ctx.beginPath()
    ctx.arc(W / 2, y + imgSize / 2, imgSize / 2, 0, Math.PI * 2)
    ctx.clip()
    ctx.drawImage(avatar, imgX, y, imgSize, imgSize)
    ctx.restore()
    y += imgSize + 32
  } catch { y += 16 }

  // 6. 类型代码
  ctx.font = '900 80px "Playfair Display", serif'
  ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'
  ctx.fillText(props.typeCode, W / 2, y + 64); y += 88

  // 7. 类型名称
  ctx.font = 'bold 26px "Noto Sans SC", sans-serif'
  ctx.fillStyle = '#FFFFFFE0'
  ctx.fillText(props.typeName.replace('型', ''), W / 2, y + 20)
  y = headerH + 46

  // 8. 四维状态条（白色背景区域）
  if (props.scores && props.chars) {
    const dims = [
      { key: 'E_I' as const, label: '能量来源', left: 'I', right: 'E' },
      { key: 'S_N' as const, label: '认知方式', left: 'N', right: 'S' },
      { key: 'T_F' as const, label: '决策方式', left: 'F', right: 'T' },
      { key: 'P_J' as const, label: '生活态度', left: 'P', right: 'J' },
    ]
    const barW = 540; const barH = 22; const barX = (W - barW) / 2
    const dimGap = 48; const dimStartY = y

    dims.forEach((dim, i) => {
      const dy = dimStartY + i * dimGap
      const score = props.scores![dim.key]
      const pos = Math.max(3, Math.min(97, 50 + (score / 50) * 47))
      const leftColor = DIM_COLORS[dim.left]
      const rightColor = DIM_COLORS[dim.right]

      // 标签
      ctx.font = 'bold 16px "Noto Sans SC", sans-serif'
      ctx.textAlign = 'left'; ctx.fillStyle = leftColor
      ctx.fillText(dim.left, barX - 52, dy + barH / 2 + 6)
      ctx.textAlign = 'right'; ctx.fillStyle = rightColor
      ctx.fillText(dim.right, barX + barW + 52, dy + barH / 2 + 6)

      // 滑动条底色
      ctx.fillStyle = '#E8E5DF'
      roundRect(ctx, barX, dy, barW, barH, barH / 2); ctx.fill()

      // 左半段渐变色（从左侧颜色到中间灰色）
      const leftGrad = ctx.createLinearGradient(barX, 0, barX + barW / 2, 0)
      leftGrad.addColorStop(0, leftColor + '50'); leftGrad.addColorStop(1, '#E8E5DF')
      ctx.fillStyle = leftGrad
      ctx.fillRect(barX, dy, barW / 2, barH)

      // 右半段渐变色
      const rightGrad = ctx.createLinearGradient(barX + barW / 2, 0, barX + barW, 0)
      rightGrad.addColorStop(0, '#E8E5DF'); rightGrad.addColorStop(1, rightColor + '50')
      ctx.fillStyle = rightGrad
      ctx.fillRect(barX + barW / 2, dy, barW / 2, barH)

      // 中心刻度线
      ctx.fillStyle = '#D0CCC4'; ctx.fillRect(barX + barW / 2 - 1, dy, 2, barH)

      // 圆点指示器（深色填充 + 白边）
      const dotX = barX + (barW * pos) / 100; const dotY = dy + barH / 2; const dotR = 10
      ctx.beginPath(); ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2)
      const dotColor = pos >= 50 ? rightColor : leftColor
      ctx.fillStyle = dotColor; ctx.fill()
      ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2.5; ctx.stroke()

      // 数字得分
      ctx.font = 'bold 10px "DM Mono", monospace'
      ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'
      const displayScore = score > 0 ? `+${score}` : `${score}`
      ctx.fillText(displayScore, dotX, dotY + 3)
    })

    y = dimStartY + dims.length * dimGap + 40
  }

  // 9. 分隔线
  ctx.strokeStyle = '#E0D8CC'; ctx.lineWidth = 1; ctx.beginPath()
  ctx.moveTo((W - 80) / 2, y); ctx.lineTo((W + 80) / 2, y); ctx.stroke()
  y += 44

  // 10. 二维码
  try {
    const qrImg = await loadImage(qrDataUrl.value)
    const qrSize = 140; const qrX = (W - qrSize) / 2
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.06)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 3
    roundRect(ctx, qrX - 14, y - 14, qrSize + 28, qrSize + 28, 16)
    ctx.fillStyle = '#FFFFFF'; ctx.fill()
    ctx.restore()
    ctx.drawImage(qrImg, qrX, y, qrSize, qrSize)
    y += qrSize + 24
  } catch { y += 16 }

  // 11. 扫码文字
  ctx.font = '600 17px "Noto Sans SC", sans-serif'
  ctx.fillStyle = '#2D2D2D'
  ctx.fillText('扫码测测你的人格类型', W / 2, y + 14); y += 28
  ctx.font = '13px "Noto Sans SC", sans-serif'
  ctx.fillStyle = '#9C958E'
  ctx.fillText('发现你的 81 型专属人格画像', W / 2, y + 10); y += 46

  // 12. Footer
  ctx.font = '11px "Noto Sans SC", sans-serif'
  ctx.fillStyle = '#B0A89E'
  ctx.fillText('测试结果仅供个人参考，不构成任何临床诊断依据', W / 2, y + 8)

  generatedImageUrl.value = canvas.toDataURL('image/jpeg', 0.92)
}

onMounted(async () => {
  await generateQR()
  try { await drawPoster() }
  catch { hasError.value = true }
  finally { isGenerating.value = false; showModal.value = true }
})

function downloadPoster() {
  if (!generatedImageUrl.value) return
  const a = document.createElement('a')
  a.href = generatedImageUrl.value
  a.download = `MBTI-PRO-${props.typeCode}.jpg`
  a.click()
}

async function copyToClipboard() {
  if (!generatedImageUrl.value) return
  try {
    const blob = await (await fetch(generatedImageUrl.value)).blob()
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
  } catch { downloadPoster() }
}

const showShare = computed(() => showModal.value && !isGenerating.value && !hasError.value)
const showError = computed(() => showModal.value && !isGenerating.value && hasError.value)
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
    <div v-if="showShare" class="fixed inset-0 z-50 flex items-center justify-center p-5">
      <div class="absolute inset-0 bg-charcoal/50 backdrop-blur-sm" @click="emit('close')" />
      <div class="relative bg-cream rounded-3xl p-6 max-w-sm w-full shadow-2xl animate-scale-in">
        <h3 class="text-lg font-display font-bold text-charcoal mb-2 text-center">分享你的人格画像</h3>
        <p class="text-sm text-text-muted text-center mb-5">长按保存图片，分享到朋友圈</p>
        <div class="rounded-2xl overflow-hidden mb-5" style="box-shadow: 0 8px 32px rgba(0,0,0,0.1);">
          <img :src="generatedImageUrl" :alt="`${typeCode} 分享海报`" class="w-full" />
        </div>
        <div class="flex gap-3">
          <button @click="emit('close')" class="flex-1 px-4 py-3 text-sm font-medium text-text-secondary border border-border rounded-xl">关闭</button>
          <button @click="downloadPoster" class="flex-1 px-4 py-3 text-sm font-semibold bg-charcoal text-cream rounded-xl">保存图片</button>
          <button @click="copyToClipboard" class="flex-1 px-4 py-3 text-sm font-semibold text-white rounded-xl" :style="{ background: props.typeColor.hex }">复制图片</button>
        </div>
      </div>
    </div>
  </Transition>

  <Transition name="modal">
    <div v-if="showError" class="fixed inset-0 z-50 flex items-center justify-center p-5">
      <div class="absolute inset-0 bg-charcoal/50 backdrop-blur-sm" @click="emit('close')" />
      <div class="relative bg-cream rounded-3xl p-6 max-w-sm w-full shadow-2xl animate-scale-in text-center">
        <h3 class="text-lg font-bold text-charcoal mb-2">分享你的人格画像</h3>
        <p class="text-sm text-text-muted mb-5">长按保存下方卡片</p>
        <div class="rounded-2xl p-5 flex flex-col items-center" :style="{ background: `linear-gradient(160deg, ${typeColor.hex}10, ${typeColor.hex}25, #FAFAF8)` }">
          <p class="text-5xl font-black tracking-wide mb-2" :style="{ color: typeColor.hex }">{{ typeCode }}</p>
          <p class="text-lg font-bold text-charcoal mb-1">{{ typeName }}</p>
          <div v-if="qrDataUrl" class="bg-white rounded-2xl p-3 mb-2"><img :src="qrDataUrl" class="w-28 h-28" /></div>
          <p class="text-xs text-text-muted">扫码测测你的人格类型</p>
        </div>
        <button @click="emit('close')" class="mt-4 px-4 py-3 text-sm text-text-secondary border border-border rounded-xl w-full">关闭</button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-enter-active, .modal-leave-active { transition: all 0.3s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
</style>
