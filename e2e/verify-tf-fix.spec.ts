import { test, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const SCREENSHOT_DIR = path.resolve('H:/ccwork/MBTI-PRO/e2e/screenshots')

test.describe('T/F 维度光谱条修复验证', () => {

  test.beforeAll(() => {
    if (!fs.existsSync(SCREENSHOT_DIR)) {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
    }
  })

  // 辅助函数：提取光谱条中的数字和位置
  async function readSpectrumData(page: any) {
    // 获取所有光谱条容器
    const bars = await page.locator('.w-full.max-w-md .flex.flex-col.gap-5 > div').all()
    if (bars.length === 0) {
      return null
    }

    const spectrums: Record<string, { normalized: string; leftPercent: string; char: string }> = {}
    const dimKeys = ['E_I', 'S_N', 'T_F', 'P_J']

    for (let i = 0; i < bars.length && i < dimKeys.length; i++) {
      const bar = bars[i]
      // 获取圆点内数字 (normalized score)
      const dotText = await bar.locator('.text-\\[10px\\].font-bold').textContent().catch(() => '')
      // 获取圆点的 left 样式
      const dotStyle = await bar.locator('.w-8.h-8.rounded-full.shadow-lg').getAttribute('style').catch(() => '')
      const leftMatch = dotStyle?.match(/left:\s*([\d.]+)%/)
      const leftPercent = leftMatch ? leftMatch[1] : 'N/A'
      // 获取分类字母
      const charText = await bar.locator('.text-xs.font-bold.px-2').textContent().catch(() => '')

      spectrums[dimKeys[i]] = {
        normalized: dotText?.trim() || 'N/A',
        leftPercent,
        char: charText?.trim() || 'N/A',
      }
    }

    return spectrums
  }

  test('场景1: 空提交 - T_F 应显示约 -34，圆点在约 34% 位置，类型码 ABFD', async ({ page }) => {
    // 清除 localStorage
    await page.goto('http://localhost:5173')
    await page.evaluate(() => localStorage.removeItem('mbti-pro-test'))

    // 等待首页加载
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'scenario1-01-homepage.png'), fullPage: true })

    // 点击"开始测试"按钮
    const startBtn = page.locator('a[href="/test"], button').filter({ hasText: /开始测试|开始/ }).first()
    if (await startBtn.isVisible()) {
      await startBtn.click()
    } else {
      await page.goto('http://localhost:5173/test')
    }

    // 等待题目加载
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // 直接点击"下一题"跳过所有题目，直到出现提交确认
    let attempts = 0
    const maxAttempts = 120

    while (attempts < maxAttempts) {
      attempts++

      // 检查是否有提交确认弹窗
      const confirmBtn = page.locator('button').filter({ hasText: '确认提交' })
      if (await confirmBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'scenario1-02-submit-confirm.png'), fullPage: true })
        await confirmBtn.click()
        break
      }

      // 检查是否有客观题介绍弹窗
      const readyBtn = page.locator('button').filter({ hasText: '准备好了' })
      if (await readyBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        await readyBtn.click()
        // 等待倒计时结束（20秒超时自动跳转）
        await page.waitForTimeout(21000) // 等待倒计时结束
        continue
      }

      // 检查是否有"下一题"或"提交结果"按钮
      const nextBtn = page.locator('button').filter({ hasText: /下一题|提交结果/ }).first()
      if (await nextBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        await nextBtn.click()
        await page.waitForTimeout(300)
        continue
      }

      // 如果找不到按钮，可能是页面还没有渲染完成
      await page.waitForTimeout(500)
    }

    // 等待结果页加载
    await page.waitForURL(/\/result\//, { timeout: 30000 })
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000) // 等待动画完成

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'scenario1-03-result-full.png'), fullPage: true })

    // 读取光谱条数据
    const spectrums = await readSpectrumData(page)
    console.log('场景1 光谱条数据:', JSON.stringify(spectrums, null, 2))

    // 获取类型码
    const typeCode = page.url().split('/result/')[1]?.split('?')[0] || 'N/A'
    console.log('场景1 类型码:', typeCode)

    // 验证 T_F
    if (spectrums) {
      const tf = spectrums.T_F
      console.log(`T_F normalized = ${tf.normalized}, left = ${tf.leftPercent}%, char = ${tf.char}`)

      const tfScore = parseInt(tf.normalized, 10)

      // 验证：T_F normalized 应在 -34 附近（允许 ±5 浮动）
      expect(Math.abs(tfScore - (-34))).toBeLessThanOrEqual(5)

      // 验证：圆点位置大约在 34% 附近（允许 ±8 浮动）
      const dotPos = parseFloat(tf.leftPercent)
      expect(Math.abs(dotPos - 34)).toBeLessThanOrEqual(8)

      // 验证：分类字母为 F
      expect(tf.char).toBe('F')

      // 验证：所有圆点位置在 3%-97% 范围内
      for (const [key, data] of Object.entries(spectrums)) {
        const pos = parseFloat(data.leftPercent)
        expect(pos, `${key} dot position out of range`).toBeGreaterThanOrEqual(3)
        expect(pos, `${key} dot position out of range`).toBeLessThanOrEqual(97)
      }
    }

    // 验证类型码为 ABFD
    expect(typeCode).toBe('ABFD')
  })

  test('场景2: 正常答题 - T_F 光谱条数字和位置合理', async ({ page }) => {
    // 清除 localStorage 并刷新
    await page.goto('http://localhost:5173')
    await page.evaluate(() => localStorage.removeItem('mbti-pro-test'))
    await page.waitForLoadState('networkidle')

    // 点击"开始测试"
    const startBtn = page.locator('a[href="/test"], button').filter({ hasText: /开始测试|开始/ }).first()
    if (await startBtn.isVisible()) {
      await startBtn.click()
    } else {
      await page.goto('http://localhost:5173/test')
    }

    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'scenario2-01-test-start.png'), fullPage: true })

    // 尽可能多地回答题目（至少回答一部分来产生有意义的分数）
    const maxQuestions = 100  // 安全上限
    let questionCount = 0

    while (questionCount < maxQuestions) {
      questionCount++

      // 检查是否有确认提交弹窗
      const confirmBtn = page.locator('button').filter({ hasText: '确认提交' })
      if (await confirmBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'scenario2-02-submit-confirm.png'), fullPage: true })
        await confirmBtn.click()
        break
      }

      // 检查客观题介绍弹窗
      const readyBtn = page.locator('button').filter({ hasText: '准备好了' })
      if (await readyBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        await readyBtn.click()
        // 随机选择一个选项
        const options = page.locator('.grid button, [class*="option"] button')
        const count = await options.count()
        if (count > 0) {
          const randomIdx = Math.floor(Math.random() * count)
          await options.nth(randomIdx).click()
          await page.waitForTimeout(500)
        }
        continue
      }

      // 检查是否有"提交结果"按钮（表示已经是最后一题）
      const submitBtn = page.locator('button').filter({ hasText: '提交结果' })
      if (await submitBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        // 先选一个选项再提交
        const options = page.locator('button[class*="rounded-2xl"]').first()
        const allButtons = page.locator('footer button, main button').filter({ hasText: /非常认同|认同|中立/ })
        const btnCount = await allButtons.count()
        if (btnCount > 0) {
          const randomIdx = Math.floor(Math.random() * btnCount)
          await allButtons.nth(randomIdx).click()
          await page.waitForTimeout(300)
        }
        await submitBtn.click()
        await page.waitForTimeout(1000)
        // 可能在确认弹窗中
        continue
      }

      // 尝试选择答案（likert 题）
      // 查找双极量表选项
      const likertOptions = page.locator('footer button').filter({ hasText: /非常认同|认同|中立/ })
      const likertCount = await likertOptions.count()
      if (likertCount > 0) {
        // 随机选择一个（尽量丰富多样）
        const idx = Math.floor(Math.random() * likertCount)
        await likertOptions.nth(idx).click()
        await page.waitForTimeout(500)
        continue
      }

      // 查找客观题选项 (A/B/C/D)
      const objOptions = page.locator('main button').filter({ hasText: /^[A-D]$|^[A-D]\s/ })
      const objCount = await objOptions.count()
      if (objCount > 0) {
        const idx = Math.floor(Math.random() * objCount)
        await objOptions.nth(idx).click()
        await page.waitForTimeout(500)
        continue
      }

      // 如果找不到可交互的选项，尝试点击下一题
      const nextBtn = page.locator('button').filter({ hasText: /下一题/ }).first()
      if (await nextBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        await nextBtn.click()
        await page.waitForTimeout(300)
        continue
      }

      // 如果还是找不到，等待一下再试
      await page.waitForTimeout(1000)
    }

    // 等待结果页加载
    await page.waitForURL(/\/result\//, { timeout: 30000 })
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000) // 等待动画完成

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'scenario2-03-result-full.png'), fullPage: true })

    // 读取光谱条数据
    const spectrums = await readSpectrumData(page)
    console.log('场景2 光谱条数据:', JSON.stringify(spectrums, null, 2))

    // 获取类型码
    const typeCode = page.url().split('/result/')[1]?.split('?')[0] || 'N/A'
    console.log('场景2 类型码:', typeCode)

    if (spectrums) {
      // 验证 T_F 数字在 -100 到 +100 范围内
      const tfScore = parseInt(spectrums.T_F.normalized, 10)
      expect(tfScore, 'T_F normalized score out of range').toBeGreaterThanOrEqual(-100)
      expect(tfScore, 'T_F normalized score out of range').toBeLessThanOrEqual(100)

      // 验证 T_F 数字不出现 -67 这样的极端值（除非真的接近极值）
      // 重点：如果 char 是 C(复合型)，数字应该不会到 -67
      if (spectrums.T_F.char === 'C') {
        expect(Math.abs(tfScore), 'T_F=C but score is extreme').toBeLessThan(50)
      }

      // 验证所有维度的圆点位置在 3%-97% 范围内
      for (const [key, data] of Object.entries(spectrums)) {
        const pos = parseFloat(data.leftPercent)
        expect(pos, `${key} dot position out of range [3%, 97%]`).toBeGreaterThanOrEqual(3)
        expect(pos, `${key} dot position out of range [3%, 97%]`).toBeLessThanOrEqual(97)
      }

      // 验证圆点位置与数字一致性
      for (const [key, data] of Object.entries(spectrums)) {
        const num = parseInt(data.normalized, 10)
        const pos = parseFloat(data.leftPercent)
        // 数字越负，位置越小（越靠左）
        // 数字越正，位置越大（越靠右）
        // -100 → 约 3%, 0 → 约 50%, +100 → 约 97%
        const expectedPos = 3 + ((num + 100) / 200) * 94
        expect(Math.abs(pos - expectedPos), `${key} dot position mismatch: expected ~${expectedPos.toFixed(1)}%, got ${pos}%`).toBeLessThanOrEqual(5)
      }

      // 验证分类字母与光谱条位置的一致性
      for (const [key, data] of Object.entries(spectrums)) {
        const pos = parseFloat(data.leftPercent)
        // F/C/T vs 位置
        if (key === 'T_F') {
          if (data.char === 'F') {
            // F 应该在左侧（偏F），pos < 50%
            // 但考虑到阈值映射的特性，F 区域对应 normalized < -17
            // 实际 pos 应该在 3%-~43% 左右
            expect(pos, `T_F char=F but dot at ${pos}%`).toBeLessThanOrEqual(55)
          } else if (data.char === 'T') {
            // T 应该在右侧（偏T）
            expect(pos, `T_F char=T but dot at ${pos}%`).toBeGreaterThanOrEqual(45)
          } else if (data.char === 'C') {
            // C 中间复合型
            expect(pos, `T_F char=C but dot at ${pos}%`).toBeGreaterThanOrEqual(20)
            expect(pos, `T_F char=C but dot at ${pos}%`).toBeLessThanOrEqual(80)
          }
        }
      }
    }

    // 截图光谱条特写
    const spectrumSection = page.locator('.max-w-md.mx-auto')
    if (await spectrumSection.isVisible()) {
      await spectrumSection.screenshot({ path: path.join(SCREENSHOT_DIR, 'scenario2-04-spectrum-closeup.png') })
    }
  })

})
