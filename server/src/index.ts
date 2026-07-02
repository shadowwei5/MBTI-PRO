import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { PrismaClient } from '@prisma/client'
import { loadServerEnv } from './config/env.js'
import { questionRoutes } from './routes/questions.js'
import { resultRoutes } from './routes/results.js'
import { recordRoutes } from './routes/records.js'
import feedbackRoutes from './routes/feedback.js'
import { paymentRoutes } from './routes/payment.js'
import { referralRoutes } from './routes/referrals.js'
import { adminRoutes } from './routes/admin.js'
import { socialUnlockRoutes } from './routes/socialUnlocks.js'
import { shareUnlockRoutes } from './routes/shareUnlocks.js'
import emailRoutes from './routes/email.js'

loadServerEnv()

export const prisma = new PrismaClient()

const app = express()
const PORT = process.env.PORT || 3001
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// CORS锛氬紑鍙戠幆澧?+ 鐢熶骇鍩熷悕
const ALLOWED_ORIGINS = [
  'http://localhost:5173', 'http://localhost:5174', 'http://localhost:4173',
  process.env.CLIENT_ORIGIN,
].filter(Boolean) as string[]

app.use(cors({ origin: ALLOWED_ORIGINS }))
app.use(express.json({ limit: '8mb' }))
app.use(express.urlencoded({ extended: true, limit: '8mb' })) // XorPay 鍥炶皟浣跨敤 form-urlencoded

app.use('/api/questions', questionRoutes)
app.use('/api/results', resultRoutes)
app.use('/api/records', recordRoutes)
app.use('/api/feedback', feedbackRoutes)
app.use('/api/payment', paymentRoutes)
app.use('/api/referrals', referralRoutes)
app.use('/api/social-unlocks', socialUnlockRoutes)
app.use('/api/share-unlocks', shareUnlockRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/email', emailRoutes)

// Serve AI-generated personality type images (full resolution, for detail page & poster)
const imagesDir = path.resolve(__dirname, '..', 'generated_images')
const thumbsDir = path.join(imagesDir, 'thumbs')

// 公用图片响应头
function setImageCacheHeaders(res: express.Response, maxAge: number, immutable = false) {
  res.setHeader('Cache-Control', `public, max-age=${maxAge}${immutable ? ', immutable' : ''}`)
  res.setHeader('Access-Control-Allow-Origin', '*')
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function upsertHeadTag(html: string, marker: string, replacement: string) {
  const start = html.indexOf(marker)
  if (start >= 0) {
    const tagStart = html.lastIndexOf('<meta', start)
    const tagEnd = html.indexOf('>', start)
    if (tagStart >= 0 && tagEnd >= 0) {
      return html.slice(0, tagStart) + replacement + html.slice(tagEnd + 1)
    }
  }
  return html.replace('</head>', '    ' + replacement + '\n  </head>')
}

function buildShareMetaHtml(html: string, meta: { title: string; description: string; url: string; image: string }) {
  const title = escapeHtml(meta.title)
  const description = escapeHtml(meta.description)
  const url = escapeHtml(meta.url)
  const image = escapeHtml(meta.image)
  let output = html.replace(/<title>.*?<\/title>/i, '<title>' + title + '</title>')
  output = upsertHeadTag(output, 'name="description"', '<meta name="description" content="' + description + '" />')
  output = upsertHeadTag(output, 'property="og:title"', '<meta property="og:title" content="' + title + '" />')
  output = upsertHeadTag(output, 'property="og:description"', '<meta property="og:description" content="' + description + '" />')
  output = upsertHeadTag(output, 'property="og:type"', '<meta property="og:type" content="article" />')
  output = upsertHeadTag(output, 'property="og:url"', '<meta property="og:url" content="' + url + '" />')
  output = upsertHeadTag(output, 'property="og:image"', '<meta property="og:image" content="' + image + '" />')
  output = upsertHeadTag(output, 'property="og:image:width"', '<meta property="og:image:width" content="1200" />')
  output = upsertHeadTag(output, 'property="og:image:height"', '<meta property="og:image:height" content="630" />')
  output = upsertHeadTag(output, 'name="twitter:title"', '<meta name="twitter:title" content="' + title + '" />')
  output = upsertHeadTag(output, 'name="twitter:description"', '<meta name="twitter:description" content="' + description + '" />')
  output = upsertHeadTag(output, 'name="twitter:image"', '<meta name="twitter:image" content="' + image + '" />')
  return output
}

app.get('/api/images/:typeCode', (req, res) => {
  const typeCode = req.params.typeCode.toUpperCase()
  const imagePath = path.join(imagesDir, `${typeCode}.jpg`)
  if (fs.existsSync(imagePath)) {
    setImageCacheHeaders(res, 86400)
    res.sendFile(imagePath)
  } else {
    res.status(404).json({ success: false, error: 'Image not found' })
  }
})

// 缂╃暐鍥剧鐐? 棣栭〉缃戞牸鐢?320px WebP (~4KB)
// 涓浘绔偣: 璇︽儏椤?娴锋姤鐢?640px WebP (~15KB)
const mediumsDir = path.join(imagesDir, 'mediums')

app.get('/api/mediums/:typeCode', (req, res) => {
  const typeCode = req.params.typeCode.toUpperCase()
  const mediumPath = path.join(mediumsDir, `${typeCode}.webp`)
  if (fs.existsSync(mediumPath)) {
    setImageCacheHeaders(res, 604800, true)
    res.setHeader('Content-Type', 'image/webp')
    res.sendFile(mediumPath)
  } else {
    const thumbPath = path.join(thumbsDir, `${typeCode}.webp`)
    if (fs.existsSync(thumbPath)) {
      setImageCacheHeaders(res, 604800, true)
      res.setHeader('Content-Type', 'image/webp')
      res.sendFile(thumbPath)
    } else {
      const imagePath = path.join(imagesDir, `${typeCode}.jpg`)
      if (fs.existsSync(imagePath)) { setImageCacheHeaders(res, 86400); res.sendFile(imagePath) }
      else res.status(404).json({ success: false, error: 'Image not found' })
    }
  }
})

// 缂╃暐鍥剧鐐? 棣栭〉缃戞牸鐢?320px WebP (~4KB)
app.get('/api/thumbs/:typeCode', (req, res) => {
  const typeCode = req.params.typeCode.toUpperCase()
  const thumbPath = path.join(thumbsDir, `${typeCode}.webp`)
  if (fs.existsSync(thumbPath)) {
    setImageCacheHeaders(res, 604800, true)
    res.setHeader('Content-Type', 'image/webp')
    res.sendFile(thumbPath)
  } else {
    // 缩略图不存在时回退到原图
    const imagePath = path.join(imagesDir, `${typeCode}.jpg`)
    if (fs.existsSync(imagePath)) {
      setImageCacheHeaders(res, 86400)
      res.sendFile(imagePath)
    } else {
      res.status(404).json({ success: false, error: 'Image not found' })
    }
  }
})

// Production: serve frontend static files
const clientDist = path.resolve(__dirname, '..', '..', 'client', 'dist')
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist))

  app.get('/result/:typeCode', async (req, res, next) => {
    try {
      const code = req.params.typeCode.toUpperCase()
      const indexPath = path.join(clientDist, 'index.html')
      const html = fs.readFileSync(indexPath, 'utf-8')
      const type = await prisma.personalityType.findUnique({ where: { code } })
      const title = type
        ? code + ' ' + type.name + '\uFF5CMBTI-PRO 81\u578B\u4EBA\u683C'
        : code + '\uFF5CMBTI-PRO 81\u578B\u4EBA\u683C'
      const description = type?.overview
        ? type.overview.replace(/\s+/g, ' ').slice(0, 110)
        : '\u4FDD\u7559\u4F20\u7EDF16\u578B\uFF0C\u65B0\u589E65\u79CD\u4E2D\u95F4\u578B\uFF0C\u53D1\u73B0\u66F4\u63A5\u8FD1\u771F\u5B9E\u81EA\u5DF1\u7684\u6027\u683C\u753B\u50CF\u3002'
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.send(buildShareMetaHtml(html, {
        title,
        description,
        url: 'https://mbti-pro.com/result/' + code,
        image: 'https://mbti-pro.com/api/images/' + code,
      }))
    } catch (error) {
      next(error)
    }
  })

  // SPA fallback: all non-API routes serve index.html
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'))
  })
  console.log(`[static] serving frontend from ${clientDist}`)
}

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Error]', err.message)
  res.status(500).json({ error: err.message || 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`MBTI-PRO API running at http://localhost:${PORT}`)
})

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect()
  process.exit(0)
})
