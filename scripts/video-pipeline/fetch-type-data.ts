// ============================================================
// MBTI-PRO Video Pipeline — 类型数据获取
// 从本地 MBTI-PRO API 获取完整人格类型数据
// ============================================================

import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import type { PersonalityTypeData, ApiResponse } from './types.js'
import { getTypeColor, getNineGroupCode, getAllNineGroups } from './utils/colors.js'

const API_BASE = process.env.MBTI_API_URL ?? 'http://localhost:3001/api'

/** 获取单个人格类型的完整数据 */
export async function fetchTypeData(typeCode: string): Promise<PersonalityTypeData> {
  const code = typeCode.toUpperCase()
  if (code.length !== 4 || !/^[EAI][NBS][TCF][JDP]$/.test(code)) {
    throw new Error(`无效的类型代码: ${typeCode}（必须是4位字母，如 ENFJ、ABFP）`)
  }

  const url = `${API_BASE}/results/${code}`
  console.log(`[fetch] GET ${url}`)

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`API 请求失败: ${response.status} ${response.statusText}`)
  }

  const json: ApiResponse<PersonalityTypeData> = await response.json()
  if (!json.success || !json.data) {
    throw new Error(`API 返回错误: ${json.error ?? '未知错误'}`)
  }

  // 补充颜色信息
  const colorInfo = getTypeColor(code)
  const groupCode = getNineGroupCode(code)
  const data = json.data
  return {
    ...data,
    imageUrl: data.imageUrl ?? `${API_BASE}/images/${code}`,
    // 附加颜色元数据（非 API 字段，用于视频渲染）
    ...({ _colorHex: colorInfo.hex, _colorTextHex: colorInfo.text, _groupCode: groupCode } as any),
  }
}

/** 获取所有 81 型代码列表 */
export async function fetchAllTypeCodes(): Promise<string[]> {
  const url = `${API_BASE}/results`
  console.log(`[fetch] GET ${url}`)

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`API 请求失败: ${response.status}`)
  }

  const json = await response.json()
  if (!json.success || !Array.isArray(json.data)) {
    throw new Error('API 返回格式异常')
  }

  return json.data.map((t: { code: string }) => t.code)
}

/** 保存类型数据到 JSON 文件 */
export function saveTypeData(typeCode: string, data: PersonalityTypeData, outputDir: string): string {
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true })
  }

  const filePath = join(outputDir, `${typeCode}.json`)
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
  console.log(`[fetch] 已保存: ${filePath}`)
  return filePath
}

/** 从本地 JSON 文件加载类型数据（离线模式） */
export function loadTypeDataFromFile(typeCode: string, dataDir: string): PersonalityTypeData | null {
  const filePath = join(dataDir, `${typeCode}.json`)
  if (!existsSync(filePath)) return null

  try {
    const raw = require('fs').readFileSync(filePath, 'utf-8')
    return JSON.parse(raw) as PersonalityTypeData
  } catch {
    return null
  }
}

/** 获取每日轮询类型（按 81 型顺序，从固定起点开始） */
export function getDailyTypeCode(dayIndex: number): string {
  const groups = getAllNineGroups()
  const allTypes: string[] = []
  for (const group of groups) {
    allTypes.push(...group.types)
  }
  // 去重 + 排序
  const unique = [...new Set(allTypes)].sort()
  return unique[dayIndex % unique.length]
}

// ---- CLI 入口 ----
async function main() {
  const args = process.argv.slice(2)
  if (args.length === 0) {
    console.log('用法: npx tsx fetch-type-data.ts <typeCode> [outputDir]')
    console.log('示例: npx tsx fetch-type-data.ts ENFJ')
    console.log('      npx tsx fetch-type-data.ts ENFJ ../../video/work/ENFJ')
    console.log('      npx tsx fetch-type-data.ts --all-types')
    process.exit(1)
  }

  if (args[0] === '--all-types') {
    const allCodes = await fetchAllTypeCodes()
    console.log(`[fetch] 共 ${allCodes.length} 个类型`)
    for (const code of allCodes) {
      process.stdout.write(code + ' ')
    }
    console.log()
    return
  }

  const typeCode = args[0].toUpperCase()
  const outputDir = args[1] ?? `../../video/work/${typeCode}`

  try {
    const data = await fetchTypeData(typeCode)
    saveTypeData(typeCode, data, outputDir)
    console.log(`[fetch] ✅ ${typeCode} — ${data.name}`)
  } catch (err) {
    console.error(`[fetch] ❌ ${typeCode}:`, err)
    process.exit(1)
  }
}

// 仅在直接运行时执行 CLI
const isDirectRun = process.argv[1]?.includes('fetch-type-data')
if (isDirectRun) {
  main()
}
