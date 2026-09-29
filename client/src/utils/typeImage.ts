import { IS_DEMO } from '../services/demoMode'

/**
 * 类型插画地址。
 *
 * 正式环境由后端提供 `/api/images/{code}`（无扩展名，动态返回图片）；
 * 静态演示版是预生成的文件，需要带 `.webp` 后缀。
 * 统一走这个函数，避免两种环境各自硬编码。
 */
export function typeImageUrl(code: string): string {
  return IS_DEMO ? `/demo/images/${code}.webp` : `/api/images/${code}`
}
