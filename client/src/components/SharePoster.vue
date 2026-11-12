<script setup lang="ts">
import { ref, onMounted } from 'vue'
import QRCode from 'qrcode'
import { typeImageUrl } from '../utils/typeImage'

const props = defineProps<{
  typeCode: string; typeName: string
  typeColor: { hex: string; name: string }; groupColor: { hex: string; name: string }
  oneLiner: string; imageUrl: string
  recordId?: string
  scores?: { E_I: number; S_N: number; T_F: number; P_J: number }
  chars?: { E_I: string; S_N: string; T_F: string; P_J: string }
  dimTotals?: { E_I: number; S_N: number; T_F: number; P_J: number }
}>()
const emit = defineEmits<{ close: [] }>()
const qrDataUrl = ref(''); const generatedImageUrl = ref(''); const isGenerating = ref(true)
const showModal = ref(false); const hasError = ref(false)

async function getShareUrl() {
  // 分享给朋友的是落地页；对方需要在小红书店铺购买后再兑换。
  return `${location.origin}/?utm_source=share_poster&utm_medium=poster&utm_campaign=${props.typeCode}`
}

async function generateQR() {
  try { qrDataUrl.value = await QRCode.toDataURL(await getShareUrl(), { width: 244, margin: 0, color: { dark: '#1A1A1A', light: '#FFFFFF' } }) } catch {}
}
function loadImage(s: string): Promise<HTMLImageElement> { return new Promise((rs, rj) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => rs(i); i.onerror = rj; i.src = s }) }

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const ch of text) {
    const next = line + ch
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line)
      line = ch
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines
}

// 自适应字号：保证类型码永远不会越界压到右侧图片
function fitFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  fontTemplate: (size: number) => string,
  maxWidth: number,
  startSize: number
): number {
  let size = startSize
  ctx.font = fontTemplate(size)
  while (size > 40 && ctx.measureText(text).width > maxWidth) {
    size -= 2
    ctx.font = fontTemplate(size)
  }
  return size
}

async function drawPoster() {
  // 小红书主推 3:4 竖图
  const W = 800
  const H = 1067
  const cvs = document.createElement('canvas')
  cvs.width = W * 2
  cvs.height = H * 2
  const ctx = cvs.getContext('2d')!
  ctx.scale(2, 2)

  // 等待字体加载完成，避免 canvas 回退字体导致排版偏移
  try {
    await Promise.allSettled([
      document.fonts.load('600 140px "Playfair Display"'),
      document.fonts.load('700 140px "Playfair Display"'),
      document.fonts.load('500 12px "DM Mono"'),
    ])
    await document.fonts.ready
  } catch { /* 忽略字体加载异常 */ }

  const MONO = '"DM Mono", "SF Mono", Consolas, "Roboto Mono", monospace'
  const SERIF = '"Playfair Display", "Songti SC", "STSong", SimSun, "Noto Serif CJK SC", serif'
  const SANS = '"PingFang SC", "HarmonyOS Sans SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif'

  // 纸张底与档案边框
  ctx.fillStyle = '#F2EDE3'
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = '#1E1D1A'
  ctx.lineWidth = 1
  ctx.strokeRect(40, 40, W - 80, H - 80)

  // ── 页眉 ──
  ctx.textAlign = 'left'
  ctx.fillStyle = '#1E1D1A'
  ctx.font = `500 12px ${MONO}`
  ctx.fillText('MBTI — PRO', 70, 76)
  ctx.textAlign = 'right'
  ctx.fillStyle = '#6F685D'
  ctx.font = `400 9px ${MONO}`
  ctx.fillText('PERSONALITY ARCHIVE / 81 TYPES', 730, 76)
  ctx.strokeStyle = '#D2C8B8'
  ctx.beginPath(); ctx.moveTo(70, 92); ctx.lineTo(730, 92); ctx.stroke()

  // ── 右上：人格图（保持 340×340 大图，3:4 下不缩水） ──
  const imgX = 390, imgY = 105, imgSize = 340
  try {
    const portrait = await loadImage(typeImageUrl(props.typeCode))
    ctx.drawImage(portrait, imgX, imgY, imgSize, imgSize)
    ctx.strokeStyle = '#1E1D1A'
    ctx.lineWidth = 1
    ctx.strokeRect(imgX, imgY, imgSize, imgSize)
    ctx.fillStyle = '#A63D2C'
    ctx.font = `10px ${MONO}`
    ctx.textAlign = 'left'
    ctx.fillText('81', imgX + 10, imgY + 22)
    ctx.textAlign = 'right'
    ctx.fillStyle = '#6F685D'
    ctx.fillText(props.typeCode, imgX + imgSize - 10, imgY + imgSize - 12)
  } catch { /* 图片加载失败时保留纯排版海报 */ }

  // ── 左上：档案标签块 ──
  ctx.textAlign = 'left'
  ctx.fillStyle = '#A63D2C'
  ctx.font = `500 10px ${MONO}`
  ctx.fillText('YOUR ARCHIVE', 70, 138)

  ctx.fillStyle = '#1E1D1A'
  ctx.font = `600 16px ${SERIF}`
  ctx.fillText(props.groupColor.name, 70, 166)

  ctx.strokeStyle = '#D2C8B8'
  ctx.beginPath(); ctx.moveTo(70, 188); ctx.lineTo(330, 188); ctx.stroke()

  ctx.fillStyle = '#6F685D'
  ctx.font = `400 9px ${MONO}`
  ctx.fillText('PERSONALITY ARCHIVE', 70, 212)
  ctx.fillText(`${props.typeCode} / 81 TYPES`, 70, 230)

  ctx.fillStyle = '#1E1D1A'
  ctx.font = `600 40px ${SERIF}`
  ctx.fillText(props.typeName.replace('型', ''), 70, 288)

  ctx.fillStyle = '#A63D2C'
  ctx.font = `500 12px ${MONO}`
  const coordText = props.chars
    ? `${props.chars.E_I} · ${props.chars.S_N} · ${props.chars.T_F} · ${props.chars.P_J}`
    : ''
  if (coordText) ctx.fillText(coordText, 70, 324)

  ctx.strokeStyle = '#D2C8B8'
  ctx.beginPath(); ctx.moveTo(70, 350); ctx.lineTo(330, 350); ctx.stroke()

  ctx.fillStyle = '#6F685D'
  ctx.font = `400 9px ${MONO}`
  ctx.fillText('40 QUESTIONS / 4 AXES', 70, 374)

  // ── 主标题：类型码（通栏自适应，永不越界） ──
  ctx.textAlign = 'left'
  const codeFont = (size: number) => `600 ${size}px ${SERIF}`
  const codeSize = fitFontSize(ctx, props.typeCode, codeFont, 660, 140)
  ctx.fillStyle = '#1E1D1A'
  ctx.font = codeFont(codeSize)
  ctx.fillText(props.typeCode, 70, 570)

  // ── 一句话 ──
  if (props.oneLiner) {
    ctx.fillStyle = '#6F685D'
    ctx.font = `400 16px ${SERIF}`
    const lines = wrapText(ctx, props.oneLiner, 660).slice(0, 2)
    lines.forEach((text, i) => ctx.fillText(text, 70, 620 + i * 24))
  }

  // ── 分隔线 ──
  ctx.strokeStyle = '#D2C8B8'
  ctx.beginPath(); ctx.moveTo(70, 680); ctx.lineTo(730, 680); ctx.stroke()

  // ── 四维坐标：2×2 数据网格 ──
  // 3:4 画布比原来矮 20%，四行纵排会把底部挤掉；
  // 改成两列两行，省下的纵向空间留给顶部大图，信息密度也更高。
  const hasScores = !!(props.scores && props.chars)
  if (hasScores) {
    const dims = [
      { key: 'E_I' as const, left: 'I', right: 'E', label: '能量来源', index: '01' },
      { key: 'S_N' as const, left: 'N', right: 'S', label: '认知方式', index: '02' },
      { key: 'T_F' as const, left: 'F', right: 'T', label: '决策方式', index: '03' },
      { key: 'P_J' as const, left: 'P', right: 'J', label: '生活态度', index: '04' },
    ]
    dims.forEach((dim, i) => {
      const col = i % 2, row = Math.floor(i / 2)
      const cx = col === 0 ? 70 : 420
      const y = 752 + row * 100
      const x1 = cx + 60, x2 = cx + 290
      const score = props.scores![dim.key]
      const maxScore = (props.dimTotals?.[dim.key] ?? 10) * 2
      const pos = Math.max(3, Math.min(97, 50 + (score / maxScore) * 47))

      ctx.textAlign = 'left'
      ctx.fillStyle = '#A63D2C'
      ctx.font = `10px ${MONO}`
      ctx.fillText(dim.index, cx, y - 24)
      ctx.fillStyle = '#6F685D'
      ctx.font = `11px ${SANS}`
      ctx.fillText(dim.label, cx + 26, y - 24)

      ctx.strokeStyle = '#D2C8B8'
      ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke()
      ctx.strokeStyle = '#A63D2C'
      ctx.beginPath(); ctx.moveTo((x1 + x2) / 2, y - 5); ctx.lineTo((x1 + x2) / 2, y + 5); ctx.stroke()

      const dotX = x1 + (x2 - x1) * pos / 100
      ctx.beginPath(); ctx.arc(dotX, y, 6, 0, Math.PI * 2)
      ctx.fillStyle = '#A63D2C'; ctx.fill()

      ctx.fillStyle = '#6F685D'
      ctx.font = `10px ${MONO}`
      ctx.fillText(dim.left, cx, y + 20)
      ctx.fillText(dim.right, x2 + 12, y + 20)
    })
  }

  // ── 底部 ──
  ctx.strokeStyle = '#D2C8B8'
  ctx.beginPath(); ctx.moveTo(70, 910); ctx.lineTo(730, 910); ctx.stroke()
  ctx.textAlign = 'left'
  ctx.fillStyle = '#1E1D1A'
  ctx.font = `600 16px ${SERIF}`
  ctx.fillText('扫码测测你的 81 型坐标', 70, 942)
  ctx.fillStyle = '#6F685D'
  ctx.font = `400 11px ${SANS}`
  ctx.fillText('先量清自己，再决定怎么活。', 70, 964)

  try {
    const qrImg = await loadImage(qrDataUrl.value)
    ctx.drawImage(qrImg, 636, 915, 84, 84)
  } catch {}

  ctx.textAlign = 'center'
  ctx.fillStyle = '#6F685D'
  ctx.font = `400 9px ${SANS}`
  ctx.fillText('结果仅供个人参考，不构成临床诊断或招聘决策依据', 400, 1010)

  generatedImageUrl.value = cvs.toDataURL('image/jpeg', 0.94)
}

// 只保留一处挂载钩子：移动端检测与海报生成合并执行，避免重复绘制两次
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
    <div v-if="isGenerating" class="share-loading">
      <div class="share-backdrop" />
      <div class="share-loading-panel">
        <p class="share-kicker">ARCHIVE / POSTER</p>
        <p class="share-loading-text">正在生成分享海报…</p>
      </div>
    </div>
  </Transition>

  <Transition name="modal">
    <div v-if="showModal && !isGenerating && !hasError" class="share-overlay">
      <div class="share-backdrop" @click="emit('close')" />
      <div class="share-panel">
        <p class="share-kicker">MBTI-PRO / SHARE</p>
        <h3>分享你的人格坐标</h3>
        <p class="share-hint">
          {{ isMobile ? '长按图片保存到相册' : '点击保存图片，分享给朋友' }}
        </p>

        <div class="share-image-wrap">
          <img :src="generatedImageUrl" alt="MBTI-PRO 人格分享海报" class="share-image" />
          <Transition name="fade">
            <div v-if="showLongPressHint" class="share-longpress">
              <p class="longpress-main">长按图片</p>
              <p class="longpress-sub">选择「保存图片」即可存到相册</p>
            </div>
          </Transition>
        </div>

        <div class="share-actions">
          <button type="button" class="share-secondary" @click="emit('close')">关闭</button>
          <button v-if="isMobile" type="button" class="share-primary" @click="sharePoster">分享给朋友 →</button>
          <button v-else type="button" class="share-primary" @click="downloadPoster">保存图片 →</button>
          <button v-if="!isMobile" type="button" class="share-secondary" @click="sharePoster">分享</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.share-overlay, .share-loading { position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; padding: 20px; }
.share-backdrop { position: absolute; inset: 0; background: rgba(30, 29, 26, .58); backdrop-filter: blur(4px); }
.share-panel {
  position: relative; width: 100%; max-width: 390px; padding: 24px;
  border: 1px solid #1e1d1a; border-radius: 2px; background: #f8f4ec; color: #1e1d1a;
  box-shadow: none;
}
.share-loading-panel { position: relative; padding: 26px 32px; border: 1px solid #1e1d1a; background: #f8f4ec; }
.share-kicker { margin: 0 0 10px; color: #a63d2c; font-family: "DM Mono", "SF Mono", Consolas, "Roboto Mono", monospace; font-size: 9px; letter-spacing: .1em; }
.share-panel h3, .share-loading-text { margin: 0; font-family: "Playfair Display", "Songti SC", "STSong", SimSun, "Noto Serif CJK SC", "Source Han Serif SC", serif; font-size: 23px; font-weight: 600; letter-spacing: -.03em; }
.share-hint { margin: 8px 0 16px; color: #6f685d; font-size: 12px; }
.share-image-wrap { position: relative; border: 1px solid #d2c8b8; background: #f2ede3; overflow: hidden; }
.share-image { display: block; width: 100%; }
.share-longpress { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(30,29,26,.82); color: #f8f4ec; text-align: center; }
.longpress-main { margin: 0 0 6px; font-family: "Playfair Display", "Songti SC", "STSong", SimSun, "Noto Serif CJK SC", "Source Han Serif SC", serif; font-size: 24px; }
.longpress-sub { margin: 0; font-size: 12px; color: #d8d0c1; }
.share-actions { display: flex; gap: 10px; margin-top: 18px; }
.share-primary, .share-secondary { flex: 1; min-height: 44px; padding: 10px 12px; border-radius: 0; font-size: 12px; font-weight: 600; }
.share-primary { border: 1px solid #1e1d1a; background: #1e1d1a; color: #f8f4ec; }
.share-primary:hover { background: #a63d2c; border-color: #a63d2c; }
.share-secondary { border: 1px solid #d2c8b8; background: transparent; color: #6f685d; }
.share-secondary:hover { border-color: #1e1d1a; color: #1e1d1a; }
.modal-enter-active, .modal-leave-active { transition: opacity .22s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.fade-enter-active, .fade-leave-active { transition: opacity .2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
