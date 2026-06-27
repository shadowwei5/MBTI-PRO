// ============================================================
// MBTI-PRO Video Pipeline — 共享类型定义
// ============================================================

/** 四维分数 */
export interface DimensionScores {
  E_I: number
  S_N: number
  T_F: number
  P_J: number
}

/** 四维字符结果 */
export interface DimensionChars {
  E_I: 'E' | 'A' | 'I'
  S_N: 'N' | 'B' | 'S'
  T_F: 'T' | 'C' | 'F'
  P_J: 'J' | 'D' | 'P'
}

/** 从 API 获取的完整人格类型数据 */
export interface PersonalityTypeData {
  code: string
  name: string
  isTraditional: boolean
  overview: string
  strengths: string[]
  growthAreas: string[]
  careers: string[]
  suitableFields: string[]
  population: string | null
  celebrities: string[] | null
  eiModule: string | null
  snModule: string | null
  tfModule: string | null
  pjModule: string | null
  imageUrl?: string
}

/** 9 组颜色信息 */
export interface GroupColorInfo {
  code: string
  name: string
  hex: string
  textHex: string
  description: string
  types: string[]
}

/** 类型颜色信息 */
export interface TypeColorInfo {
  hex: string
  textHex: string
  groupCode: string
  groupName: string
  groupHex: string
}

/** 视频帧渲染配置 */
export interface FrameRenderConfig {
  typeCode: string
  outputDir: string
  width: number
  height: number
  fps: number
  durationSeconds: number
  keyframeInterval: number // 每隔多少秒截一帧
  template: 'daily-type' | 'intro-video'
}

/** 视频合成配置 */
export interface ComposeConfig {
  typeCode: string
  framesDir: string
  outputPath: string
  width: number
  height: number
  fps: number
  bgmPath?: string
  transitionFrames: number // xfade 过渡帧数
  durationSeconds: number
}

/** 口播+录屏拼接配置 */
export interface TalkingHeadConfig {
  rawFootageDir: string
  outputPath: string
  metadata: TalkingHeadMetadata
}

export interface TalkingHeadMetadata {
  segments: {
    type: 'talking' | 'screencast'
    startTime: number // 秒
    endTime: number // 秒
    description?: string
  }[]
  bgmPath?: string
  outputDuration: number // 目标总时长（秒）
}

/** 发布任务 */
export interface PublishTask {
  typeCode: string
  videoPath: string
  coverPath: string
  title: string
  description: string
  tags: string[]
  platforms: Platform[]
  scheduleTime?: string // ISO 8601
}

export type Platform = 'douyin' | 'bilibili' | 'xiaohongshu' | 'wechat'

export interface PublishResult {
  platform: Platform
  success: boolean
  url?: string
  error?: string
  timestamp: string
}

/** API 响应信封 */
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}
