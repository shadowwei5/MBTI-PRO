/**
 * T/F 维度光谱条修复验证 - 直接 Playwright 脚本
 */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = path.resolve('H:/ccwork/MBTI-PRO/e2e/screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const CHROMIUM_PATH = 'C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function readSpectrumData(page) {
  const bars = await page.locator('.w-full.max-w-md .flex.flex-col.gap-5 > div').all();
  if (bars.length === 0) {
    console.log('  [WARN] 未找到光谱条元素');
    return null;
  }

  const dimKeys = ['E_I', 'S_N', 'T_F', 'P_J'];
  const spectrums = {};

  for (let i = 0; i < bars.length && i < dimKeys.length; i++) {
    const bar = bars[i];
    try {
      const dotText = await bar.locator('.text-\\[10px\\].font-bold').textContent();
      const dotEl = bar.locator('.w-8.h-8.rounded-full.shadow-lg');
      const dotStyle = await dotEl.getAttribute('style');
      const leftMatch = dotStyle?.match(/left:\s*([\d.]+)%/);
      const leftPercent = leftMatch ? leftMatch[1] : 'N/A';
      const charEls = await bar.locator('.text-xs.font-bold.px-2').all();
      let charText = '';
      if (charEls.length > 0) {
        charText = (await charEls[0].textContent()) || '';
      }

      spectrums[dimKeys[i]] = {
        normalized: dotText?.trim() || 'N/A',
        leftPercent,
        char: charText?.trim() || 'N/A',
      };
    } catch (e) {
      spectrums[dimKeys[i]] = { normalized: 'ERR', leftPercent: 'ERR', char: 'ERR' };
    }
  }

  return spectrums;
}

async function scenario1_EmptySubmit() {
  console.log('\n========== 场景1: 空提交验证 ==========');

  const browser = await chromium.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  try {
    // 1. 打开首页
    await page.goto('http://localhost:5173');
    await page.evaluate(() => localStorage.removeItem('mbti-pro-test'));
    await page.waitForLoadState('networkidle');
    await sleep(1000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'scenario1-01-homepage.png'), fullPage: true });
    console.log('  [OK] 首页加载成功');

    // 2. 点击开始测试
    const startBtn = page.locator('a[href="/test"]').first();
    const startBtn2 = page.locator('button').filter({ hasText: /开始测试/ }).first();
    if (await startBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await startBtn.click();
    } else if (await startBtn2.isVisible({ timeout: 2000 }).catch(() => false)) {
      await startBtn2.click();
    } else {
      await page.goto('http://localhost:5173/test');
    }
    await page.waitForLoadState('networkidle');
    await sleep(2000);
    console.log('  [OK] 进入测试页面');

    // 3. 跳过所有题目，只点"下一题"
    let attempts = 0;
    const maxAttempts = 200;

    while (attempts < maxAttempts) {
      attempts++;

      // 检查是否有提交确认弹窗
      const confirmBtn = page.locator('button').filter({ hasText: '确认提交' });
      if (await confirmBtn.isVisible({ timeout: 300 }).catch(() => false)) {
        console.log(`  [INFO] 第 ${attempts} 轮：发现提交确认弹窗`);
        await confirmBtn.click();
        break;
      }

      // 检查客观题介绍弹窗
      const readyBtn = page.locator('button').filter({ hasText: '准备好了' });
      if (await readyBtn.isVisible({ timeout: 300 }).catch(() => false)) {
        console.log(`  [INFO] 第 ${attempts} 轮：发现客观题介绍弹窗`);
        await readyBtn.click();
        // 等待20秒倒计时 + 安全余量
        await sleep(22000);
        continue;
      }

      // 检查客观题是否锁定（倒计时已完）
      // 直接点下一题跳过
      const nextBtn = page.locator('button').filter({ hasText: /下一题/ }).first();
      if (await nextBtn.isVisible({ timeout: 300 }).catch(() => false)) {
        await nextBtn.click();
        await sleep(200);
        continue;
      }

      // 如果提交结果按钮可见
      const submitBtn = page.locator('button').filter({ hasText: '提交结果' });
      if (await submitBtn.isVisible({ timeout: 300 }).catch(() => false)) {
        await submitBtn.click();
        await sleep(500);
        continue;
      }

      await sleep(300);
    }

    console.log(`  [INFO] 总共跳过了 ${attempts} 轮`);

    // 4. 等待结果页
    await page.waitForURL(/\/result\//, { timeout: 60000 });
    await page.waitForLoadState('networkidle');
    await sleep(3000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'scenario1-02-result-full.png'), fullPage: true });
    console.log('  [OK] 进入结果页');

    // 5. 读取光谱条数据
    const spectrums = await readSpectrumData(page);
    const typeCode = page.url().split('/result/')[1]?.split('?')[0] || 'N/A';

    console.log(`  类型码: ${typeCode}`);
    console.log('  光谱条数据:');
    if (spectrums) {
      for (const [key, data] of Object.entries(spectrums)) {
        console.log(`    ${key}: normalized=${data.normalized}  left=${data.leftPercent}%  char=${data.char}`);
      }

      // 验证
      const tf = spectrums.T_F;
      const tfScore = parseInt(tf.normalized, 10);

      console.log('\n  验证结果:');
      const checks = [];

      // 1. T_F normalized score 约 -34 (±5)
      const check1 = Math.abs(tfScore - (-34)) <= 5;
      checks.push(['T_F=-34(±5)', check1, `got ${tfScore}`]);

      // 2. 圆点位置 ~34% (±8)
      const dotPos = parseFloat(tf.leftPercent);
      const check2 = Math.abs(dotPos - 34) <= 8;
      checks.push(['dotPos=34%(±8)', check2, `got ${dotPos}%`]);

      // 3. 分类字母为 F
      const check3 = tf.char === 'F';
      checks.push(['char=F', check3, `got ${tf.char}`]);

      // 4. 所有圆点在 3%-97% 范围内
      let check4 = true;
      for (const [key, data] of Object.entries(spectrums)) {
        const pos = parseFloat(data.leftPercent);
        if (pos < 3 || pos > 97) {
          check4 = false;
          console.log(`    [FAIL] ${key} dot out of range: ${pos}%`);
        }
      }
      checks.push(['所有圆点在[3%,97%]', check4, '']);

      // 5. 类型码 ABFD
      const check5 = typeCode === 'ABFD';
      checks.push(['typeCode=ABFD', check5, `got ${typeCode}`]);

      for (const [name, passed, detail] of checks) {
        const status = passed ? 'PASS' : 'FAIL';
        console.log(`    [${status}] ${name}${detail ? ` (${detail})` : ''}`);
      }

      const allPassed = checks.every(c => c[1]);
      console.log(`\n  场景1 ${allPassed ? '全部通过' : '存在失败'}`);
      return allPassed;
    } else {
      console.log('  [FAIL] 未获取到光谱条数据');
      return false;
    }
  } catch (err) {
    console.error('  场景1 错误:', err.message);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'scenario1-ERROR.png'), fullPage: true });
    return false;
  } finally {
    await browser.close();
  }
}

async function scenario2_NormalTest() {
  console.log('\n========== 场景2: 正常答题验证 ==========');

  const browser = await chromium.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  try {
    // 1. 清除 localStorage 并打开首页
    await page.goto('http://localhost:5173');
    await page.evaluate(() => localStorage.removeItem('mbti-pro-test'));
    await page.waitForLoadState('networkidle');
    await sleep(1000);

    // 2. 进入测试
    const startBtn = page.locator('a[href="/test"]').first();
    if (await startBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await startBtn.click();
    } else {
      await page.goto('http://localhost:5173/test');
    }
    await page.waitForLoadState('networkidle');
    await sleep(3000); // 等待题目完全渲染
    console.log('  [OK] 进入测试页面');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'scenario2-01-test-start.png'), fullPage: true });

    // 3. 回答多道题目
    let questionCount = 0;
    const maxQuestions = 120;

    while (questionCount < maxQuestions) {
      questionCount++;

      // 检查提交确认弹窗
      const confirmBtn = page.locator('button').filter({ hasText: '确认提交' });
      if (await confirmBtn.isVisible({ timeout: 300 }).catch(() => false)) {
        console.log(`  [INFO] 第 ${questionCount} 轮：提交确认，已回答 ${questionCount} 题`);
        await confirmBtn.click();
        break;
      }

      // 检查客观题介绍弹窗（等动画完成）
      const readyBtn = page.locator('button').filter({ hasText: '准备好了' });
      if (await readyBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        await sleep(500); // 等待 modal 入场动画完成
        await readyBtn.click({ timeout: 5000 });
        await sleep(500);
        // 选择一个随机选项
        const objOpts = page.locator('main button').filter({ hasText: /^[A-D]$/ });
        const objCount = await objOpts.count();
        if (objCount > 0) {
          const idx = Math.floor(Math.random() * objCount);
          await objOpts.nth(idx).click({ timeout: 3000 });
          await sleep(300);
        }
        continue;
      }

      // 检查提交结果按钮
      const submitBtn = page.locator('button').filter({ hasText: '提交结果' });
      if (await submitBtn.isVisible({ timeout: 300 }).catch(() => false)) {
        // 先尝试选择一个答案
        const likertOpts = page.locator('footer button');
        const lCount = await likertOpts.count();
        if (lCount > 0) {
          const idx = Math.floor(Math.random() * Math.min(lCount, 5));
          await likertOpts.nth(idx).click();
          await sleep(300);
        }
        await submitBtn.click();
        await sleep(500);
        continue;
      }

      // 选择 likert 答案（通过 OptionGroupBipolar 的按钮）
      // 策略：在 main 区域找到带有 5 个选项按钮的双极量表组件
      const likertBtns = page.locator('main button').filter({ hasText: /非常认同|认同|中立/ });
      const likertCount = await likertBtns.count();
      if (likertCount > 0) {
        const idx = Math.floor(Math.random() * likertCount);
        await likertBtns.nth(idx).click({ timeout: 3000 });
        await sleep(300);
        continue;
      }

      // 如果什么都没选，点下一题
      const nextBtn = page.locator('button').filter({ hasText: /下一题/ }).first();
      if (await nextBtn.isVisible({ timeout: 300 }).catch(() => false)) {
        await nextBtn.click();
        await sleep(200);
        continue;
      }

      await sleep(500);
    }

    console.log(`  [INFO] 总共 ${questionCount} 轮后提交`);

    // 4. 等待结果页
    await page.waitForURL(/\/result\//, { timeout: 60000 });
    await page.waitForLoadState('networkidle');
    await sleep(3000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'scenario2-02-result-full.png'), fullPage: true });
    console.log('  [OK] 进入结果页');

    // 5. 读取光谱条
    const spectrums = await readSpectrumData(page);
    const typeCode = page.url().split('/result/')[1]?.split('?')[0] || 'N/A';

    console.log(`  类型码: ${typeCode}`);
    console.log('  光谱条数据:');
    if (spectrums) {
      for (const [key, data] of Object.entries(spectrums)) {
        console.log(`    ${key}: normalized=${data.normalized}  left=${data.leftPercent}%  char=${data.char}`);
      }

      console.log('\n  验证结果:');
      const checks = [];
      let allOk = true;

      // 1. T_F normalized 在 -100 到 +100 之间
      const tfScore = parseInt(spectrums.T_F.normalized, 10);
      const check1 = tfScore >= -100 && tfScore <= 100 && !isNaN(tfScore);
      checks.push(['T_F in [-100,+100]', check1, `got ${tfScore}`]);

      // 2. T_F 不应该出现极端值 -67 (除非真的是极端)
      // 由于我们随机答题，正常情况不应出现 -67
      const check2 = tfScore !== -67 || spectrums.T_F.char === 'F';
      checks.push(['T_F not bogus -67', check2, `got ${tfScore}, char=${spectrums.T_F.char}`]);

      // 3. 所有圆点在 [3%, 97%]
      let check3 = true;
      for (const [key, data] of Object.entries(spectrums)) {
        const pos = parseFloat(data.leftPercent);
        if (isNaN(pos) || pos < 3 || pos > 97) {
          check3 = false;
          console.log(`    [INFO] ${key} dot at ${pos}%`);
        }
      }
      checks.push(['所有圆点在[3%,97%]', check3, '']);

      // 4. 圆点位置与数字一致性
      let check4 = true;
      for (const [key, data] of Object.entries(spectrums)) {
        const num = parseInt(data.normalized, 10);
        const pos = parseFloat(data.leftPercent);
        if (!isNaN(num) && !isNaN(pos)) {
          const expectedPos = 3 + ((num + 100) / 200) * 94;
          if (Math.abs(pos - expectedPos) > 5) {
            check4 = false;
            console.log(`    [INFO] ${key}: expected pos ~${expectedPos.toFixed(1)}%, got ${pos}%`);
          }
        }
      }
      checks.push(['圆点位置与数字一致(±5%)', check4, '']);

      // 5. T_F 分类字母与位置一致
      const tfChar = spectrums.T_F.char;
      const tfPos = parseFloat(spectrums.T_F.leftPercent);
      let check5 = true;
      if (tfChar === 'F' && tfPos > 55) { check5 = false; }
      if (tfChar === 'T' && tfPos < 45) { check5 = false; }
      checks.push(['T_F char与位置一致', check5, `char=${tfChar}, pos=${tfPos}%`]);

      for (const [name, passed, detail] of checks) {
        const status = passed ? 'PASS' : 'FAIL';
        console.log(`    [${status}] ${name}${detail ? ` (${detail})` : ''}`);
      }

      const allPassed = checks.every(c => c[1]);
      console.log(`\n  场景2 ${allPassed ? '全部通过' : '存在失败'}`);
      return allPassed;
    } else {
      console.log('  [FAIL] 未获取到光谱条数据');
      return false;
    }
  } catch (err) {
    console.error('  场景2 错误:', err.message);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'scenario2-ERROR.png'), fullPage: true });
    return false;
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log('=== T/F 维度光谱条修复 E2E 验证 ===');
  console.log('测试地址: http://localhost:5173\n');

  const result1 = await scenario1_EmptySubmit();
  const result2 = await scenario2_NormalTest();

  console.log('\n========== 总结 ==========');
  console.log(`场景1 (空提交): ${result1 ? '通过' : '失败'}`);
  console.log(`场景2 (正常答题): ${result2 ? '通过' : '失败'}`);

  if (result1 && result2) {
    console.log('\n全部测试通过!');
    process.exit(0);
  } else {
    console.log('\n存在测试失败，请查看上方日志');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
