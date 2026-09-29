/**
 * 演示模式开关
 *
 * 服务器停止后，前端可以以纯静态方式部署（Vercel / Netlify / GitHub Pages）。
 * 构建时设置 VITE_DEMO_MODE=1 即启用：
 *   - 题库与 81 型内容从 /demo/*.json 读取，不再请求后端
 *   - 评分在浏览器本地完成（复用与后端同一份 scoring.ts 纯函数）
 *   - 支付、打赏、邮件、写入类接口全部停用并给出明确提示
 *
 * 所有数据是静态样本，不会写入任何数据库。
 */
export const IS_DEMO = import.meta.env.VITE_DEMO_MODE === '1'
