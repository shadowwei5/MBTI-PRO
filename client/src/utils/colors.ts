// MBTI-PRO 基于传统四气质（NT/NF/SJ/SP）的12色调色板
// 参考 16personalities.com：紫(NT) · 绿(NF) · 蓝(SJ) · 金(SP)
// 每种气质含 3 个色阶（I=深 / A=中 / E=亮），共计 12 色

/** 四气质颜色定义 */
export interface GroupColor {
  name: string
  hex: string
  text: string
}

/** 传统 MBTI 四气质色 */
export const TEMPERAMENT_COLORS: Record<string, GroupColor> = {
  NT: { name: '分析师', hex: '#8869A5', text: '#6B4A7D' },
  NF: { name: '外交家', hex: '#33A474', text: '#1F8258' },
  SJ: { name: '守护者', hex: '#4298B4', text: '#2E7A95' },
  SP: { name: '探险家', hex: '#E4AE3A', text: '#C08E20' },
}

/** 四气质 × 三能级(E外向/A均衡/I内向) = 12色调色板 */
const FAMILY_PALETTE: Record<string, Record<string, string>> = {
  purple: { E: '#8869A5', A: '#7B5C9A', I: '#6D3A8A' },
  green:  { E: '#44B678', A: '#33A474', I: '#1B7A4A' },
  blue:   { E: '#5BA4C0', A: '#4298B4', I: '#2E6B8A' },
  gold:   { E: '#F0C860', A: '#E4AE3A', I: '#C88020' },
}

/** 获取任意81型代码所属的四气质色系 */
export function getTypeColorFamily(code: string): 'purple' | 'green' | 'blue' | 'gold' {
  const sn = code[1]
  const tf = code[2]
  const pj = code[3]

  // N 型 → 紫(NT) 或 绿(NF)
  if (sn === 'N') {
    if (tf === 'T' || tf === 'C') return 'purple'
    return 'green'
  }
  // S 型 → 蓝(SJ) 或 金(SP)
  if (sn === 'S') {
    if (pj === 'J' || pj === 'D') return 'blue'
    return 'gold'
  }
  // B 均衡型 → 按 T_F 或 P_J 偏向归类
  if (tf === 'T') return 'purple'
  if (tf === 'F') return 'green'
  // C 均衡 T_F → 按 P_J 偏向
  if (pj === 'J' || pj === 'D') return 'blue'
  return 'gold'
}

/** 获取任意81型代码的专属 hex 颜色 */
export function getTypeHex(code: string): string {
  const family = getTypeColorFamily(code)
  const ei = code[0] // E / A / I
  return FAMILY_PALETTE[family][ei] ?? FAMILY_PALETTE[family]['A']
}

/** 获取任意81型代码的完整颜色信息 */
export function getTypeColor(code: string): GroupColor {
  const family = getTypeColorFamily(code)
  const base = TEMPERAMENT_COLORS[family.toUpperCase() as keyof typeof TEMPERAMENT_COLORS]
  // 使用 NT/NF/SJ/SP 查找
  const key = family === 'purple' ? 'NT' : family === 'green' ? 'NF' : family === 'blue' ? 'SJ' : 'SP'
  const temperamentColor = TEMPERAMENT_COLORS[key]
  const hex = getTypeHex(code)
  return {
    name: temperamentColor?.name ?? '',
    hex,
    text: hex,
  }
}

/** 获取传统四气质 (仅纯端值16型有效) */
export function getTemperament(code: string): string | null {
  const sn = code[1]
  const tf = code[2]
  const pj = code[3]
  if (sn === 'N' && tf === 'T') return 'NT'
  if (sn === 'N' && tf === 'F') return 'NF'
  if (sn === 'S' && pj === 'J') return 'SJ'
  if (sn === 'S' && pj === 'P') return 'SP'
  return null
}

/** 获取四气质颜色 */
export function getTemperamentColor(code: string): GroupColor | null {
  const temp = getTemperament(code)
  return temp ? (TEMPERAMENT_COLORS[temp] ?? null) : null
}

/** 兼容旧 API：九组色 -> 按首个类型的气质色返回（用于 DimensionSpectrum 等） */
export function getNineGroupColor(code: string): GroupColor {
  return getTypeColor(code)
}

export function getNineGroupHex(code: string): string {
  return getTypeHex(code)
}

/** 九组色映射（兼容旧引用） */
export const NINE_COLORS: Record<string, GroupColor> = {
  EN: { name: '暖紫', hex: FAMILY_PALETTE.purple.E, text: FAMILY_PALETTE.purple.E },
  EB: { name: '珊瑚', hex: '#E8735A', text: '#C05A3E' },
  ES: { name: '琥珀', hex: FAMILY_PALETTE.blue.E, text: FAMILY_PALETTE.blue.E },
  AN: { name: '薰紫', hex: FAMILY_PALETTE.purple.A, text: FAMILY_PALETTE.purple.A },
  AB: { name: '青灰', hex: '#6B9B8A', text: '#4A7A6A' },
  AS: { name: '鼠尾草', hex: FAMILY_PALETTE.blue.A, text: FAMILY_PALETTE.blue.A },
  IN: { name: '靛蓝', hex: FAMILY_PALETTE.purple.I, text: FAMILY_PALETTE.purple.I },
  IB: { name: '钢蓝', hex: '#5B82A8', text: '#3D6490' },
  IS: { name: '深青', hex: FAMILY_PALETTE.blue.I, text: FAMILY_PALETTE.blue.I },
}
