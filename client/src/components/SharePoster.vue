<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import QRCode from 'qrcode'

const props = defineProps<{
  typeCode: string; typeName: string
  typeColor: { hex: string; name: string }; groupColor: { hex: string; name: string }
  oneLiner: string; imageUrl: string
  scores?: { E_I: number; S_N: number; T_F: number; P_J: number }
  chars?: { E_I: string; S_N: string; T_F: string; P_J: string }
}>()
const emit = defineEmits<{ close: [] }>()
const qrDataUrl = ref(''); const generatedImageUrl = ref(''); const isGenerating = ref(true)
const showModal = ref(false); const hasError = ref(false)

const W = 750
const DIM_COLORS: Record<string, string> = {
  I: '#3D6FFF', E: '#FF5722', N: '#6A1B9A', S: '#00796B',
  F: '#0277BD', T: '#E65100', P: '#BF8C00', J: '#1565C0',
}

async function generateQR() {
  try { qrDataUrl.value = await QRCode.toDataURL(`${location.origin}/#/test?ref=share`, { width: 90, margin: 0, color: { dark: '#1A1A1A', light: '#FFFFFF' } }) } catch {}
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
  // 计算内容高度，自适应画布
  const hasScores = !!(props.scores && props.chars)
  const imgH = 380
  let h = 36 + 26 + imgH + 22 + 74 + 38 // top + brand + image + code + name
  if (hasScores) h += 4 * 60 + 28 // 维度条
  h += 20 + 82 + 20 // divider + QR + footer margin
  const H = Math.max(h, 800) // 最低 800px

  const cvs = document.createElement('canvas'); cvs.width = W * 2; cvs.height = H * 2
  const ctx = cvs.getContext('2d')!; ctx.scale(2, 2)

  // 背景 — 顶部和底部带色渐变，中间纯白不干扰文字
  const tc = props.typeColor.hex
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, tc + '0D')
  bg.addColorStop(0.12, '#FFFFFF')
  bg.addColorStop(0.5, '#FFFFFF')
  bg.addColorStop(0.88, '#FFFFFF')
  bg.addColorStop(1, tc + '0D')
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)

  // 顶部色条
  ctx.fillStyle = props.typeColor.hex; ctx.fillRect(0, 0, W, 5)
  const tg = ctx.createLinearGradient(0, 5, 0, 110); tg.addColorStop(0, props.typeColor.hex + '14'); tg.addColorStop(1, 'transparent')
  ctx.fillStyle = tg; ctx.fillRect(0, 5, W, 110)

  let y = 36
  ctx.font = 'bold 11px "Noto Sans SC"'; ctx.fillStyle = '#B0A89E'; ctx.textAlign = 'center'
  ctx.fillText('MBTI PRO · 81 型人格深度测试', W / 2, y); y += 26

  // 圆形图片 — 380px 占主要视觉
  const imgSz = 380
  try {
    const avatar = await loadImage(`/api/mediums/${props.typeCode}`)
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.12)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 5
    ctx.beginPath(); ctx.arc(W / 2, y + imgSz / 2, imgSz / 2, 0, Math.PI * 2)
    ctx.fillStyle = '#fff'; ctx.fill()
    ctx.restore()
    ctx.save()
    ctx.beginPath(); ctx.arc(W / 2, y + imgSz / 2, imgSz / 2, 0, Math.PI * 2); ctx.clip()
    ctx.drawImage(avatar, W / 2 - imgSz / 2, y, imgSz, imgSz)
    ctx.restore()
    y += imgSz + 22
  } catch { y += 16 }

  // 类型代码
  ctx.font = '900 78px "Playfair Display", serif'; ctx.fillStyle = props.typeColor.hex
  ctx.fillText(props.typeCode, W / 2, y + 62); y += 74

  // 类型名称
  ctx.font = 'bold 25px "Noto Sans SC"'; ctx.fillStyle = '#2D2D2D'
  ctx.fillText(props.typeName.replace('型', ''), W / 2, y + 20); y += 38

  // 四维状态条 — 占满剩余主空间
  if (hasScores) {
    const dims = [
      { key: 'E_I' as const, left: 'I', right: 'E' },
      { key: 'S_N' as const, left: 'N', right: 'S' },
      { key: 'T_F' as const, left: 'F', right: 'T' },
      { key: 'P_J' as const, left: 'P', right: 'J' },
    ]
    const barW = 540; const barH = 26; const barX = (W - barW) / 2; const dimGap = 60

    dims.forEach((dim, i) => {
      const dy = y + i * dimGap; const score = props.scores![dim.key]
      const pos = Math.max(3, Math.min(97, 50 + (score / 50) * 47))
      const lc = DIM_COLORS[dim.left]; const rc = DIM_COLORS[dim.right]

      ctx.font = 'bold 17px "Noto Sans SC"'
      ctx.textAlign = 'left'; ctx.fillStyle = lc; ctx.fillText(dim.left, barX - 54, dy + barH / 2 + 6)
      ctx.textAlign = 'right'; ctx.fillStyle = rc; ctx.fillText(dim.right, barX + barW + 54, dy + barH / 2 + 6)

      ctx.fillStyle = '#EAE7E0'; rRect(ctx, barX, dy, barW, barH, barH / 2); ctx.fill()
      ctx.fillStyle = '#D4D0C8'; ctx.fillRect(barX + barW / 2 - 1.5, dy, 3, barH)
      const lg = ctx.createLinearGradient(barX, 0, barX + barW / 2, 0); lg.addColorStop(0, lc + '45'); lg.addColorStop(1, '#EAE7E0')
      ctx.fillStyle = lg; ctx.fillRect(barX, dy, barW / 2, barH)
      const rg = ctx.createLinearGradient(barX + barW / 2, 0, barX + barW, 0); rg.addColorStop(0, '#EAE7E0'); rg.addColorStop(1, rc + '45')
      ctx.fillStyle = rg; ctx.fillRect(barX + barW / 2, dy, barW / 2, barH)

      const dotX = barX + (barW * pos) / 100; const dotY = dy + barH / 2; const dotR = 10
      ctx.beginPath(); ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2)
      ctx.fillStyle = pos >= 50 ? rc : lc; ctx.fill()
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.stroke()

      ctx.font = 'bold 10px "DM Mono", monospace'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'
      ctx.fillText(score > 0 ? `+${score}` : `${score}`, dotX, dotY + 3)
    })
    y += dims.length * dimGap + 28
  }

  // 分隔线
  ctx.strokeStyle = '#E0D8CC'; ctx.lineWidth = 1; ctx.beginPath()
  ctx.moveTo((W - 80) / 2, y); ctx.lineTo((W + 80) / 2, y); ctx.stroke()
  y += 18

  // 底部：左文字 + 右极小二维码（零浪费）
  const qrS = 80; const qrX = W - qrS - 54
  ctx.textAlign = 'left'
  ctx.font = 'bold 15px "Noto Sans SC"'; ctx.fillStyle = '#2D2D2D'
  ctx.fillText('扫码测测你的人格类型', 54, y + 14)
  ctx.font = '11px "Noto Sans SC"'; ctx.fillStyle = '#9C958E'
  ctx.fillText('发现你的 81 型专属人格画像', 54, y + 30)

  try {
    const qrImg = await loadImage(qrDataUrl.value)
    rRect(ctx, qrX - 4, y - 4, qrS + 8, qrS + 8, 8)
    ctx.fillStyle = '#fff'; ctx.fill()
    ctx.drawImage(qrImg, qrX, y, qrS, qrS)
  } catch {}
  y += qrS + 10

  // 免责
  ctx.textAlign = 'center'; ctx.font = '9px "Noto Sans SC"'; ctx.fillStyle = '#B0A89E'
  ctx.fillText('测试结果仅供个人参考，不构成任何临床诊断依据', W / 2, y + 6)

  generatedImageUrl.value = cvs.toDataURL('image/jpeg', 0.92)
}

onMounted(async () => {
  await generateQR()
  try { await drawPoster() } catch { hasError.value = true }
  finally { isGenerating.value = false; showModal.value = true }
})

function downloadPoster() { if (!generatedImageUrl.value) return; const a = document.createElement('a'); a.href = generatedImageUrl.value; a.download = `MBTI-PRO-${props.typeCode}.jpg`; a.click() }
async function copyToClipboard() { if (!generatedImageUrl.value) return; try { const b = await (await fetch(generatedImageUrl.value)).blob(); await navigator.clipboard.write([new ClipboardItem({ [b.type]: b })]) } catch { downloadPoster() } }
const showShare = computed(() => showModal.value && !isGenerating.value && !hasError.value)
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
      <div class="relative bg-cream rounded-3xl p-6 max-w-sm w-full shadow-2xl">
        <h3 class="text-lg font-bold text-charcoal mb-2 text-center">分享你的人格画像</h3>
        <p class="text-sm text-text-muted text-center mb-5">长按保存图片，分享到朋友圈</p>
        <div class="rounded-2xl overflow-hidden mb-5" style="box-shadow:0 8px 32px rgba(0,0,0,.1)"><img :src="generatedImageUrl" class="w-full" /></div>
        <div class="flex gap-3">
          <button @click="emit('close')" class="flex-1 px-4 py-3 text-sm font-medium text-text-secondary border border-border rounded-xl">关闭</button>
          <button @click="downloadPoster" class="flex-1 px-4 py-3 text-sm font-semibold bg-charcoal text-cream rounded-xl">保存图片</button>
          <button @click="copyToClipboard" class="flex-1 px-4 py-3 text-sm font-semibold text-white rounded-xl" :style="{background:typeColor.hex}">复制图片</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-enter-active,.modal-leave-active{transition:all .3s ease}
.modal-enter-from,.modal-leave-to{opacity:0}
</style>
