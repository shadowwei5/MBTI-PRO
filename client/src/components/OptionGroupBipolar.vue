<script setup lang="ts">
defineProps<{
  textLeft: string
  textRight: string
  modelValue: string | null
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()

/**
 * 选项文案采用「正方 / 反方」这种中性的角色标签：
 * 1. 不暴露这道题在测哪个维度（外向/内向等），避免用户按自我标签作答；
 * 2. 不依赖空间位置，桌面端左右排列、手机端上下排列都不会产生歧义。
 *
 * key 仍为 A~E 用于计分，但界面上不再显示字母。
 */
const scale = [
  { key: 'A', main: '非常认同', side: '正方', label: '非常认同正方' },
  { key: 'B', main: '比较认同', side: '正方', label: '比较认同正方' },
  { key: 'C', main: '中立', side: '', label: '中立' },
  { key: 'D', main: '比较认同', side: '反方', label: '比较认同反方' },
  { key: 'E', main: '非常认同', side: '反方', label: '非常认同反方' },
]
</script>

<template>
  <div class="bipolar">
    <div class="statements">
      <div class="statement" :class="{ 'statement--active': modelValue === 'A' || modelValue === 'B' }">
        <span class="statement-meta">正方</span>
        <p>{{ textLeft }}</p>
      </div>
      <div class="statement" :class="{ 'statement--active': modelValue === 'D' || modelValue === 'E' }">
        <span class="statement-meta">反方</span>
        <p>{{ textRight }}</p>
      </div>
    </div>

    <div class="scale" role="radiogroup" aria-label="选择更认同哪一方">
      <button
        v-for="option in scale"
        :key="option.key"
        type="button"
        class="scale-option"
        :class="{ 'scale-option--selected': modelValue === option.key }"
        role="radio"
        :aria-checked="modelValue === option.key"
        :aria-label="option.label"
        @click="$emit('update:modelValue', option.key)"
      >
        <span class="scale-main">{{ option.main }}</span>
        <span v-if="option.side" class="scale-side">{{ option.side }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.bipolar {
  --paper: #f2ede3;
  --paper-light: #f8f4ec;
  --ink: #1e1d1a;
  --muted: #6f685d;
  --rule: #d2c8b8;
  --accent: #a63d2c;
  width: 100%;
}

.statements {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border-top: 1px solid var(--ink);
  border-bottom: 1px solid var(--rule);
}

.statement {
  min-height: 150px;
  padding: 22px 26px 24px 0;
  transition: background .2s ease;
}
.statement + .statement {
  padding-left: 26px;
  padding-right: 0;
  border-left: 1px solid var(--rule);
}
.statement--active {
  background: rgba(166, 61, 44, .055);
  /* 正方 / 反方使用完全相同的选中特效：同底色 + 同一侧（左）强调条 */
  box-shadow: inset 3px 0 0 var(--accent);
}

.statement-meta {
  display: block;
  margin-bottom: 14px;
  color: var(--accent);
  font-family: "Playfair Display", "Songti SC", "STSong", SimSun, "Noto Serif CJK SC", "Source Han Serif SC", serif;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: .18em;
}

.statement p {
  margin: 0;
  font-family: "Playfair Display", "Songti SC", "STSong", SimSun, "Noto Serif CJK SC", "Source Han Serif SC", serif;
  font-size: clamp(18px, 2vw, 23px);
  line-height: 1.65;
  color: var(--ink);
}

.scale {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  margin-top: 18px;
  border: 1px solid var(--rule);
}

.scale-option {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 56px;
  padding: 8px 6px;
  border: 0;
  border-right: 1px solid var(--rule);
  border-radius: 0;
  background: var(--paper-light);
  color: var(--muted);
  transition: background .18s ease, color .18s ease;
}
.scale-option:last-child { border-right: 0; }
.scale-option:hover { background: #e9e1d4; color: var(--ink); }
.scale-option--selected { background: var(--ink); color: var(--paper-light); }
.scale-option--selected:hover { background: var(--accent); color: var(--paper-light); }

.scale-main { font-size: 13px; font-weight: 600; line-height: 1.35; white-space: nowrap; }
.scale-side {
  font-size: 11px;
  line-height: 1.35;
  opacity: .72;
  white-space: nowrap;
}
.scale-option--selected .scale-side { opacity: .85; }

@media (max-width: 680px) {
  .statements { grid-template-columns: 1fr; }
  .statement { min-height: 0; padding: 18px 0 20px; }
  .statement + .statement {
    padding: 18px 0 20px;
    border-left: 0;
    border-top: 1px solid var(--rule);
  }
  .statement p { font-size: 18px; }
  .statement-meta { margin-bottom: 10px; font-size: 13px; }
  .scale { margin-top: 14px; }

  /* 手机端每格约 68px，六个字一行放不下 —— 拆成两行 */
  .scale-option {
    flex-direction: column;
    gap: 2px;
    min-height: 58px;
    padding: 8px 2px;
  }
  .scale-main { font-size: 11px; }
  .scale-side { font-size: 10px; }
}
</style>
