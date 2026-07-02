import { chromium } from 'playwright'
import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { scalePopulationFor81 } from './population.js'
import { TYPE_SUMMARIES } from '../content/types.js'
import { getTypeDimensionModules } from '../content/dimension-modules.js'

const prisma = new PrismaClient()
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const imagesDir = path.resolve(__dirname, '..', '..', 'generated_images')
const reportFontPath = path.resolve(__dirname, '..', '..', 'assets', 'fonts', 'SourceHanSansCN-Regular.ttf')

let reportFontFaceCache: string | null = null

type ReportData = {
  code: string
  name: string
  summary: string
  overview: string
  strengths: string[]
  growthAreas: string[]
  careers: string[]
  suitableFields: string[]
  population: string | null
  celebrities: string[]
  eiModule: string | null
  snModule: string | null
  tfModule: string | null
  pjModule: string | null
}

const DIM_TOTAL = 25
const MAX_SCORE = DIM_TOTAL * 2

const dims = [
  { key: 'E_I', displayKey: 'E/A/I', label: '能量来源', left: 'I 内向', mid: 'A 平衡', right: 'E 外向', dotColor: '#82B1FF', leftColor: '#5C8DFF', rightColor: '#FF8A65' },
  { key: 'S_N', displayKey: 'S/B/N', label: '认知方式', left: 'N 直觉', mid: 'B 均衡', right: 'S 实感', dotColor: '#B388FF', leftColor: '#9C6FFF', rightColor: '#69F0AE' },
  { key: 'T_F', displayKey: 'T/C/F', label: '决策方式', left: 'F 情感', mid: 'C 复合', right: 'T 思考', dotColor: '#40C4FF', leftColor: '#1DA8FF', rightColor: '#FFD740' },
  { key: 'P_J', displayKey: 'P/D/J', label: '生活态度', left: 'P 感知', mid: 'D 动态', right: 'J 判断', dotColor: '#FFD740', leftColor: '#E6B800', rightColor: '#82B1FF' },
] as const

const fallbackScores: Record<string, number> = { E_I: -22, S_N: 20, T_F: 22, P_J: 19 }

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function normalizedScore(raw: number) {
  return Math.round((raw / MAX_SCORE) * 100)
}

function dotPosition(norm: number) {
  return 3 + ((norm + 100) / 200) * 94
}

function charScore(typeCode: string, dimKey: string): number {
  const chars = {
    E_I: typeCode[0],
    S_N: typeCode[1],
    T_F: typeCode[2],
    P_J: typeCode[3],
  } as Record<string, string>

  const char = chars[dimKey]
  if (dimKey === 'E_I') return char === 'I' ? -22 : char === 'E' ? 22 : 0
  if (dimKey === 'S_N') return char === 'N' ? 20 : char === 'S' ? -20 : 0
  if (dimKey === 'T_F') return char === 'T' ? 22 : char === 'F' ? -22 : 0
  if (dimKey === 'P_J') return char === 'J' ? 19 : char === 'P' ? -19 : 0
  return fallbackScores[dimKey] ?? 0
}

function resultLetter(dimKey: string, raw: number) {
  if (dimKey === 'E_I') return raw < -16 ? 'I' : raw > 16 ? 'E' : 'A'
  if (dimKey === 'S_N') return raw < -16 ? 'S' : raw > 16 ? 'N' : 'B'
  if (dimKey === 'T_F') return raw < -16 ? 'F' : raw > 16 ? 'T' : 'C'
  if (dimKey === 'P_J') return raw < -16 ? 'P' : raw > 16 ? 'J' : 'D'
  return '?'
}

function resultLabel(dimKey: string, letter: string) {
  const map: Record<string, Record<string, string>> = {
    E_I: { I: '内向', E: '外向', A: '适中' },
    S_N: { N: '直觉', S: '实感', B: '均衡' },
    T_F: { T: '理性', F: '情感', C: '兼顾' },
    P_J: { J: '计划', P: '随性', D: '弹性' },
  }
  return map[dimKey]?.[letter] || ''
}

function dimBars(typeCode: string): string {
  return dims.map(d => {
    const raw = charScore(typeCode, d.key)
    const norm = normalizedScore(raw)
    const pos = dotPosition(norm)
    const letter = resultLetter(d.key, raw)

    return `
    <div class="dim-row">
      <div class="dim-labels">
        <span style="color:${d.leftColor}">${d.left}</span>
        <span>${d.mid}</span>
        <span style="color:${d.rightColor}">${d.right}</span>
      </div>
      <div class="dim-bar">
        <div class="dim-center-zone"></div>
        <div class="dim-dot" style="left:${pos}%;background:${d.dotColor}">
          <span class="dim-dot-num">${norm}</span>
        </div>
      </div>
      <div class="dim-badge-row">
        <span class="dim-badge" style="background:${d.dotColor}">${letter}</span>
      </div>
    </div>`
  }).join('')
}

function list(items: string[]): string {
  return items.map(item => `<li>${escapeHtml(item)}</li>`).join('')
}

function tags(items: string[]): string {
  return items.map(item => `<span class="tag">${escapeHtml(item)}</span>`).join('')
}

function portraitDataUri(typeCode: string): string {
  const imagePath = path.join(imagesDir, `${typeCode}.jpg`)
  if (!fs.existsSync(imagePath)) return ''
  const base64 = fs.readFileSync(imagePath).toString('base64')
  return `data:image/jpeg;base64,${base64}`
}

function reportFontFace(): string {
  if (reportFontFaceCache !== null) return reportFontFaceCache
  if (!fs.existsSync(reportFontPath)) {
    reportFontFaceCache = ''
    return reportFontFaceCache
  }

  const base64 = fs.readFileSync(reportFontPath).toString('base64')
  const src = `url(data:font/ttf;base64,${base64}) format('truetype')`
  reportFontFaceCache = `@font-face{font-family:'MBTIProReportCJK';src:${src};font-weight:400;font-style:normal;font-display:block}@font-face{font-family:'MBTIProReportCJK';src:${src};font-weight:700;font-style:normal;font-display:block}`
  return reportFontFaceCache
}

function dimModule(typeCode: string, dimKey: string, title: string, moduleText: string | null): string {
  const raw = charScore(typeCode, dimKey)
  const letter = resultLetter(dimKey, raw)
  const norm = normalizedScore(raw)
  return `
<h2>${title}</h2>
<div class="module"><p class="dim-result">你的维度结果为 <strong>${letter}（${resultLabel(dimKey, letter)}）</strong>，归一化得分 <strong>${norm >= 0 ? '+' : ''}${norm}</strong></p><p>${escapeHtml(moduleText || '')}</p></div>`
}

export async function getReportData(typeCode: string): Promise<ReportData | null> {
  const code = typeCode.toUpperCase()
  const type = await prisma.personalityType.findUnique({ where: { code } })
  if (!type) return null

  const dimModules = getTypeDimensionModules(type.code)
  return {
    code: type.code,
    name: type.name,
    summary: TYPE_SUMMARIES[type.code] ?? '该人格类型拥有独特的四维组合特质。',
    overview: type.overview,
    strengths: JSON.parse(type.strengths),
    growthAreas: JSON.parse(type.growthAreas),
    careers: JSON.parse(type.careers),
    suitableFields: JSON.parse(type.suitableFields),
    population: scalePopulationFor81(type.population),
    celebrities: JSON.parse(type.celebrities || '[]'),
    eiModule: dimModules.eiModule,
    snModule: dimModules.snModule,
    tfModule: dimModules.tfModule,
    pjModule: dimModules.pjModule,
  }
}

export function buildReportHtml(t: ReportData): string {
  const portraitSrc = portraitDataUri(t.code) || `https://mbti-pro.com/api/images/${encodeURIComponent(t.code)}`
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>MBTI-PRO 深度人格报告 - ${escapeHtml(t.name)}</title>
<style>
${reportFontFace()}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'MBTIProReportCJK','Noto Sans CJK SC','Noto Sans SC','WenQuanYi Zen Hei','Microsoft YaHei','PingFang SC',sans-serif;color:#2D2A26;background:#FFF;max-width:800px;margin:0 auto;padding:50px 56px}
.cover{text-align:center;padding:50px 0 40px;border-bottom:2px solid #E0D8CC;margin-bottom:36px}
.cover .type-code{font-size:44px;font-weight:300;letter-spacing:8px;color:#9C958E;margin-bottom:4px}
.cover h1{font-size:44px;font-weight:700;margin-bottom:4px;color:#C8963E}
.cover .subtitle{font-size:16px;color:#6B6560;margin-top:8px}
.portrait-full{text-align:center;margin:30px 0 28px}
.portrait-img{width:280px;height:340px;border-radius:24px;object-fit:cover;border:2px solid #E0D8CC}
.dims-section{max-width:448px;margin:0 auto 32px}
.dim-row{margin-bottom:10px}
.dim-labels{display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px;padding:0 2px}
.dim-labels span:first-child{font-weight:500}.dim-labels span:last-child{font-weight:500}
.dim-bar{position:relative;height:24px;background:#F5F2EC;border-radius:12px;overflow:visible;margin-bottom:10px}
.dim-center-zone{position:absolute;left:33.33%;right:33.33%;top:0;bottom:0;background:rgba(134,187,138,0.2);border-left:2px solid rgba(134,187,138,0.3);border-right:2px solid rgba(134,187,138,0.3);border-radius:12px}
.dim-dot{position:absolute;top:50%;transform:translate(-50%,-50%);width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.2);border:2px solid #FFF;z-index:2}
.dim-dot-num{font-size:10px;font-weight:700;color:#FFF;line-height:1;text-shadow:0 1px 2px rgba(0,0,0,.15)}
.dim-badge-row{display:flex;justify-content:center;margin-top:4px}
.dim-badge{font-size:12px;font-weight:700;color:#FFF;padding:2px 10px;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.15)}
.summary-box{background:#FAF8F5;border-radius:16px;padding:24px 28px;margin:20px 0;border-left:4px solid #C8963E}
.summary-box p{font-size:17px;color:#2D2A26;line-height:1.8}
.population{text-align:center;margin:12px 0;color:#6B6560;font-size:14px}
h2{font-size:24px;font-weight:700;color:#C8963E;margin:40px 0 16px;padding-bottom:8px;border-bottom:1.5px solid #F0EBE0}
h3{font-size:18px;font-weight:600;color:#4A4540;margin:24px 0 12px}
p,li{font-size:15px;line-height:1.8;color:#4A4540}
ul{padding-left:20px;margin:8px 0 16px}.tags{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}
.tag{background:#F0EBE0;color:#6B6560;padding:4px 14px;border-radius:20px;font-size:13px}.module{background:#FAF8F5;border-radius:14px;padding:20px 24px;margin:16px 0}
.module .dim-result{font-size:14px;color:#6B6560;margin-bottom:8px}.module .dim-result strong{font-size:18px;color:#C8963E}
.footer{text-align:center;margin-top:60px;padding-top:20px;border-top:1.5px solid #E0D8CC;color:#9C958E;font-size:13px}.footer p{margin:4px 0;color:#9C958E}
</style></head>
<body>
<div class="cover"><div class="type-code">${escapeHtml(t.code)}</div><h1>${escapeHtml(t.name)}</h1><p class="subtitle">MBTI-PRO 81型人格深度报告</p></div>
<div class="portrait-full"><img class="portrait-img" src="${portraitSrc}" alt="${escapeHtml(t.name)}" /></div>
<div class="dims-section">${dimBars(t.code)}</div>
<div class="summary-box"><p>${escapeHtml(t.summary)}</p></div>
${t.population ? `<p class="population">占总人口比例：<strong>${escapeHtml(t.population)}</strong></p>` : ''}
<h2>人格概览</h2><p>${escapeHtml(t.overview)}</p>
<h2>核心优势</h2><ul>${list(t.strengths)}</ul>
<h2>成长空间</h2><ul>${list(t.growthAreas)}</ul>
<h2>职业推荐</h2><ul>${list(t.careers)}</ul>
${t.suitableFields.length ? `<h3>适合领域</h3><ul>${list(t.suitableFields)}</ul>` : ''}
${t.celebrities.length ? `<h2>代表人物</h2><div class="tags">${tags(t.celebrities)}</div>` : ''}
${dimModule(t.code, 'E_I', '能量来源（E/A/I 维度）', t.eiModule)}
${dimModule(t.code, 'S_N', '认知方式（S/B/N 维度）', t.snModule)}
${dimModule(t.code, 'T_F', '决策方式（T/C/F 维度）', t.tfModule)}
${dimModule(t.code, 'P_J', '生活态度（P/D/J 维度）', t.pjModule)}
<div class="footer"><p>MBTI-PRO · 81型人格深度解析</p><p>mbti-pro.com</p></div>
</body></html>`
}

export async function generateReportPdf(typeCode: string): Promise<Buffer> {
  const report = await getReportData(typeCode)
  if (!report) throw new Error(`Personality type not found: ${typeCode}`)

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  try {
    const page = await browser.newPage()
    await page.setContent(buildReportHtml(report), { waitUntil: 'networkidle' })
    await page.evaluate(() => document.fonts.ready)
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
    })
  } finally {
    await browser.close()
  }
}
