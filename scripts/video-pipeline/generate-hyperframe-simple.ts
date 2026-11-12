import { chromium } from 'playwright'
import { generateVoiceover } from './generate-audio.js'
import { exec as execCallback } from 'child_process'
import { promisify } from 'util'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { mkdirSync, existsSync, readdirSync, statSync } from 'fs'

const exec = promisify(execCallback)
const __dirname = dirname(fileURLToPath(import.meta.url))
const VIDEO_DIR = join(__dirname, '..', '..', 'video')
const OUTPUT_DIR = join(VIDEO_DIR, 'output')
const WORK_DIR = join(VIDEO_DIR, 'work', 'hyperframe_final')

mkdirSync(WORK_DIR, { recursive: true })
mkdirSync(OUTPUT_DIR, { recursive: true })

function getLatestWebm(dir: string): string {
  const files = readdirSync(dir)
    .filter(f => f.endsWith('.webm'))
    .map(f => ({ name: f, mtime: statSync(join(dir, f)).mtime }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
  if (files.length === 0) throw new Error('未找到录屏文件')
  return join(dir, files[0].name)
}

async function main() {
  console.log('🎬 开始生成最简宣传视频')
  
  // 1. 生成标准中文配音
  console.log('🔊 生成配音...')
  const voiceScript = `
欢迎来到 MBTI-PRO，全新 81 型人格测试。
突破传统 16 型二分法局限，每个维度有三种选择，更加精准描述真实的你。
不再是非此即彼，而是完整的人格光谱。
测试完全免费，无需注册，答完 100 题即可获得专属四维分析报告。
填写邮箱，免费解锁深度 PDF 报告和分享海报。
现在就来 MBTI-PRO，发现真实的自己。
`
  const { audioPath } = await generateVoiceover([{ text: voiceScript }], WORK_DIR, 'hyperframe_voice')
  console.log('✅ 配音完成：' + audioPath)
  
  // 2. Playwright 录屏：首页滚动 + 结果页展示
  console.log('📹 开始录屏...')
  const browser = await chromium.launch({ 
    headless: false, 
    args: ['--window-size=450,900', '--force-device-scale-factor=3']
  })
  const context = await browser.newContext({ 
    viewport: { width: 450, height: 900 }, 
    deviceScaleFactor: 3,
    recordVideo: { dir: WORK_DIR, size: { width: 1350, height: 2700 } }
  })
  const page = await context.newPage()
  
  await page.goto('https://mbti-pro.com/', { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(3000)
  
  // 缓慢滚动展示首页内容
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => window.scrollBy(0, 250))
    await page.waitForTimeout(700)
  }
  await page.waitForTimeout(2000)
  
  // 跳转到结果页
  await page.goto('https://mbti-pro.com/result/ABCD?scores=%7B%22E_I%22:0.52,%22S_N%22:0.5,%22T_F%22:0.51,%22P_J%22:0.49%7D&chars=%7B%22E_I%22:%22A%22,%22S_N%22:%22B%22,%22T_F%22:%22C%22,%22P_J%22:%22D%22%7D&confidence=100&dimTotals=%7B%22E_I%22:20,%22S_N%22:20,%22T_F%22:20,%22P_J%22:20%7D&dimAnswered=%7B%22E_I%22:20,%22S_N%22:20,%22T_F%22:20,%22P_J%22:20%7D&recordId=video-demo', { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)
  
  // 滚动结果页展示人像 + 四维分析
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.scrollBy(0, 200))
    await page.waitForTimeout(700)
  }
  await page.waitForTimeout(2000)
  
  // 展示邮箱解锁区域
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.scrollBy(0, 200))
    await page.waitForTimeout(700)
  }
  await page.waitForTimeout(3000)
  
  await context.close()
  await browser.close()
  await page.waitForTimeout(1500)
  
  const videoPath = getLatestWebm(WORK_DIR)
  console.log('✅ 录屏完成：' + videoPath)
  
  // 3. 合成视频：webm → mp4 + 音频
  console.log('🎞 合成最终视频...')
  const ffmpeg = join(__dirname, 'node_modules', '@ffmpeg-installer', 'win32-x64', 'ffmpeg.exe')
  const finalPath = join(OUTPUT_DIR, 'MBTI-PRO_Hyperframe_Final.mp4')
  
  await exec(`"${ffmpeg}" -y -i "${videoPath}" -i "${audioPath}" -c:v libx264 -preset slow -crf 18 -c:a aac -b:a 192k -pix_fmt yuv420p "${finalPath}"`)
  
  // 提取封面
  const coverPath = join(OUTPUT_DIR, 'cover_MBTI-PRO_Hyperframe_Final.png')
  await exec(`"${ffmpeg}" -y -i "${finalPath}" -ss 2 -vframes 1 "${coverPath}"`)
  
  console.log('✅ 全部完成！')
  console.log('')
  console.log('📁 输出文件：')
  console.log('  视频：', finalPath)
  console.log('  封面：', coverPath)
}

main().catch(console.error)
