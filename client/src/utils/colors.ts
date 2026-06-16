// MBTI PRO 81型 9 组颜色分类体系
// 依据：81型人格颜色分类.xlsx，按 S/B/N 三感知维度 × 人格气质分组
//
//   S系(实感)：SP暖金 / SD琥珀 / SJ藏蓝   （按 P/D/J 分组）
//   B系(均衡)：BT深炭灰 / BC月光银灰 / BF暖燕麦  （按 T/C/F 分组）
//   N系(直觉)：NT深紫 / NC靛青 / NF翠绿       （按 T/C/F 分组）

/** 9组颜色定义 */
export interface GroupColor {
  name: string
  hex: string
  text: string
}

/** 9组元数据 */
export interface NineGroupMeta {
  code: string          // 组代码，如 "SP"、"NT"
  name: string          // 中文组名，如 "SP 暖金组"
  hex: string           // 主色 hex
  description: string   // 分类定位
  traits: string        // 核心特质
  types: string[]       // 该组包含的 9 种类型代码
}

/** 9组完整颜色定义 */
const NINE_GROUPS: Record<string, GroupColor> = {
  SP: { name: 'SP 暖金组', hex: '#C8963E', text: '#A67A2E' },
  SD: { name: 'SD 琥珀组', hex: '#D4782F', text: '#A85E22' },
  SJ: { name: 'SJ 藏蓝组', hex: '#2C5F8A', text: '#1E4A70' },
  BT: { name: 'BT 深炭灰组', hex: '#4A4A4A', text: '#3A3A3A' },
  BC: { name: 'BC 月光银灰组', hex: '#8B95A0', text: '#6E7A87' },
  BF: { name: 'BF 暖燕麦组', hex: '#B8956A', text: '#9B7A52' },
  NT: { name: 'NT 深紫组', hex: '#6B3FA0', text: '#522E80' },
  NC: { name: 'NC 靛青组', hex: '#3D7B8A', text: '#2E6270' },
  NF: { name: 'NF 翠绿组', hex: '#2D8A4E', text: '#1F6E3A' },
}

/** 获取9组代码（根据4位类型代码推理） */
export function getNineGroupCode(code: string): string {
  const sn = code[1]  // S / B / N
  const tf = code[2]  // T / C / F
  const pj = code[3]  // P / D / J

  if (sn === 'S') {
    // S系按生活态度分组
    if (pj === 'P') return 'SP'
    if (pj === 'D') return 'SD'
    return 'SJ'
  }
  if (sn === 'B') {
    // B系按决策方式分组
    if (tf === 'T') return 'BT'
    if (tf === 'C') return 'BC'
    return 'BF'
  }
  // N系按决策方式分组
  if (tf === 'T') return 'NT'
  if (tf === 'C') return 'NC'
  return 'NF'
}

/** E_I 深浅微调系数（同组内 E/A/I 的视觉区分） */
const EI_MODIFIER: Record<string, { lighten: number; sat: number }> = {
  E: { lighten: 1.08, sat: 1.05 },
  A: { lighten: 1.0,  sat: 1.0 },
  I: { lighten: 0.88, sat: 1.08 },
}

/** 获取任意81型代码的专属 hex 颜色（9组主色 + E/I微调） */
export function getTypeHex(code: string): string {
  const groupCode = getNineGroupCode(code)
  const base = NINE_GROUPS[groupCode]
  if (!base) return '#888888'

  const ei = code[0]  // E / A / I
  const mod = EI_MODIFIER[ei] ?? EI_MODIFIER['A']

  // 解析 hex → HSL → 调整亮度/饱和度 → 回 hex
  const hex = base.hex.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16) / 255
  const g = parseInt(hex.substring(2, 4), 16) / 255
  const b = parseInt(hex.substring(4, 6), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2

  const newL = Math.min(1, l * mod.lighten)
  // 线性插值保持色相
  if (l === 0) return base.hex
  const ratio = newL / l
  const nr = Math.round(Math.min(1, r * ratio) * 255)
  const ng = Math.round(Math.min(1, g * ratio) * 255)
  const nb = Math.round(Math.min(1, b * ratio) * 255)

  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`
}

/** 获取任意81型代码的颜色类别名（用于UI逻辑） */
export function getTypeColorFamily(code: string): string {
  return getNineGroupCode(code)
}

/** 获取任意81型代码所属9组的完整颜色信息 */
export function getTypeColor(code: string): GroupColor {
  const groupCode = getNineGroupCode(code)
  const base = NINE_GROUPS[groupCode] ?? { name: '未知', hex: '#888888', text: '#666666' }
  return {
    name: base.name,
    hex: getTypeHex(code),
    text: base.text,
  }
}

/** 获取9组颜色（按组代码） */
export function getNineGroupColor(code: string): GroupColor {
  return NINE_GROUPS[code] ?? { name: '未知', hex: '#888888', text: '#666666' }
}

export function getNineGroupHex(code: string): string {
  return NINE_GROUPS[code]?.hex ?? '#888888'
}

/** 兼容旧 API：传统四气质（仅纯端值16型有效） */
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

/** 四气质颜色（仅用于传统16型兼容） */
export const TEMPERAMENT_COLORS: Record<string, GroupColor> = {
  NT: { name: '分析师', hex: '#6B3FA0', text: '#522E80' },
  NF: { name: '外交家', hex: '#2D8A4E', text: '#1F6E3A' },
  SJ: { name: '守护者', hex: '#2C5F8A', text: '#1E4A70' },
  SP: { name: '探险家', hex: '#C8963E', text: '#A67A2E' },
}

export function getTemperamentColor(code: string): GroupColor | null {
  const temp = getTemperament(code)
  return temp ? (TEMPERAMENT_COLORS[temp] ?? null) : null
}

/** 全部9组元数据（用于首页网格等） */
export function getAllNineGroups(): NineGroupMeta[] {
  return [
    {
      code: 'SP', name: 'SP 暖金组', hex: NINE_GROUPS.SP.hex,
      description: '纯 S 系（感觉型）· P 型（灵活感知）',
      traits: '关注当下细节，应变能力强，崇尚自由随性，擅长实操解决问题，行动力优先于规划，享受即时体验',
      types: ['ISTP', 'ISCP', 'ISFP', 'ASTP', 'ASCP', 'ASFP', 'ESTP', 'ESCP', 'ESFP'],
    },
    {
      code: 'SD', name: 'SD 琥珀组', hex: NINE_GROUPS.SD.hex,
      description: '纯 S 系（感觉型）· D 型（J/P 中间态）',
      traits: '兼具 SP 的灵活应变与 SJ 的规则意识，做事张弛有度，靠谱但不死板，能在秩序与灵活间动态平衡',
      types: ['ISTD', 'ISCD', 'ISFD', 'ASTD', 'ASCD', 'ASFD', 'ESTD', 'ESCD', 'ESFD'],
    },
    {
      code: 'SJ', name: 'SJ 藏蓝组', hex: NINE_GROUPS.SJ.hex,
      description: '纯 S 系（感觉型）· J 型（秩序判断）',
      traits: '重视规则与责任，做事严谨有条理，偏好稳定可控的环境，责任心强，是社会秩序与组织规则的核心维护者',
      types: ['ISTJ', 'ISCJ', 'ISFJ', 'ASTJ', 'ASCJ', 'ASFJ', 'ESTJ', 'ESCJ', 'ESFJ'],
    },
    {
      code: 'BT', name: 'BT 深炭灰组', hex: NINE_GROUPS.BT.hex,
      description: '平衡感知 B 型 · T 型（理性思考主导）',
      traits: '感知上兼顾具体细节与抽象规律，决策以逻辑为核心，既能落地处理实务，也能做长远规划',
      types: ['IBTP', 'IBTD', 'IBTJ', 'ABTP', 'ABTD', 'ABTJ', 'EBTP', 'EBTD', 'EBTJ'],
    },
    {
      code: 'BC', name: 'BC 月光银灰组', hex: NINE_GROUPS.BC.hex,
      description: '平衡感知 B 型 · C 型（T/F 中间态）',
      traits: 'S/N、T/F 两大核心维度均处于平衡状态，场景适配性极强，可理性可共情，可动可静',
      types: ['IBCP', 'IBCD', 'IBCJ', 'ABCP', 'ABCD', 'ABCJ', 'EBCP', 'EBCD', 'EBCJ'],
    },
    {
      code: 'BF', name: 'BF 暖燕麦组', hex: NINE_GROUPS.BF.hex,
      description: '平衡感知 B 型 · F 型（情感共情主导）',
      traits: '兼顾真实生活细节与深层精神感受，决策以情感价值为核心，治愈感与落地感兼具',
      types: ['IBFP', 'IBFD', 'IBFJ', 'ABFP', 'ABFD', 'ABFJ', 'EBFP', 'EBFD', 'EBFJ'],
    },
    {
      code: 'NT', name: 'NT 深紫组', hex: NINE_GROUPS.NT.hex,
      description: '纯 N 系（直觉型）· T 型（理性思考主导）',
      traits: '擅长抽象逻辑与战略思辨，追求真理与体系构建，理性优先，关注长远规律与底层逻辑',
      types: ['INTP', 'INTD', 'INTJ', 'ANTP', 'ANTD', 'ANTJ', 'ENTP', 'ENTD', 'ENTJ'],
    },
    {
      code: 'NC', name: 'NC 靛青组', hex: NINE_GROUPS.NC.hex,
      description: '纯 N 系（直觉型）· C 型（T/F 中间态）',
      traits: '兼具 NT 的逻辑思辨与 NF 的人文关怀，决策时既坚持逻辑框架，又兼顾他人情绪与意义感',
      types: ['INCP', 'INCD', 'INCJ', 'ANCP', 'ANCD', 'ANCJ', 'ENCP', 'ENCD', 'ENCJ'],
    },
    {
      code: 'NF', name: 'NF 翠绿组', hex: NINE_GROUPS.NF.hex,
      description: '纯 N 系（直觉型）· F 型（情感共情主导）',
      traits: '关注精神价值与人的成长，富有共情力与理想主义，追求意义与自我实现，擅长人际连接与价值引导',
      types: ['INFP', 'INFD', 'INFJ', 'ANFP', 'ANFD', 'ANFJ', 'ENFP', 'ENFD', 'ENFJ'],
    },
  ]
}

/** NINE_COLORS 兼容旧引用 */
export const NINE_COLORS: Record<string, GroupColor> = Object.fromEntries(
  Object.entries(NINE_GROUPS).map(([k, v]) => [k, v])
)
