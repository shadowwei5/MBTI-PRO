/**
 * 40 题首发版题库
 *
 * 设计原则：
 * - 四维各 10 题，覆盖 8-9 个不同侧面，而不是重复问同一种行为；
 * - 题目顺序按 E_I → S_N → T_F → P_J 循环排列，降低维度启动效应；
 * - T_F 只保留主观双极题，不把逻辑推理题计入人格类型；
 * - 每维原始分范围 -20 ~ +20，三级阈值取约 ±7。
 */
export const SHORT_FORM_VERSION = '40q-v1'

export const SHORT_FORM_QUESTION_IDS = [
  // 第 1 轮
  1, 26, 76, 51,
  // 第 2 轮
  2, 27, 77, 52,
  // 第 3 轮
  3, 28, 79, 54,
  // 第 4 轮
  5, 29, 80, 55,
  // 第 5 轮
  6, 34, 82, 57,
  // 第 6 轮
  8, 40, 83, 60,
  // 第 7 轮
  9, 41, 85, 61,
  // 第 8 轮
  11, 44, 86, 70,
  // 第 9 轮
  13, 45, 89, 72,
  // 第 10 轮
  20, 50, 90, 75,
] as const

export const SHORT_FORM_TOTAL = SHORT_FORM_QUESTION_IDS.length

export const SHORT_FORM_DIMENSION_COUNTS = {
  E_I: 10,
  S_N: 10,
  T_F: 10,
  P_J: 10,
} as const
