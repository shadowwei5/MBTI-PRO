import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { PrismaClient } from '@prisma/client'
import { questionRoutes } from './routes/questions.js'
import { resultRoutes } from './routes/results.js'
import { recordRoutes } from './routes/records.js'

export const prisma = new PrismaClient()

const app = express()
const PORT = process.env.PORT || 3001
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// CORS：开发环境 + 生产域名
const ALLOWED_ORIGINS = [
  'http://localhost:5173', 'http://localhost:5174', 'http://localhost:4173',
  process.env.CLIENT_ORIGIN,
].filter(Boolean) as string[]

app.use(cors({ origin: ALLOWED_ORIGINS }))
app.use(express.json())

app.use('/api/questions', questionRoutes)
app.use('/api/results', resultRoutes)
app.use('/api/records', recordRoutes)

// Serve AI-generated personality type images
const imagesDir = path.resolve(__dirname, '..', 'generated_images')
app.get('/api/images/:typeCode', (req, res) => {
  const typeCode = req.params.typeCode.toUpperCase()
  const imagePath = path.join(imagesDir, `${typeCode}.jpg`)
  if (fs.existsSync(imagePath)) {
    res.setHeader('Cache-Control', 'public, max-age=86400')
    res.sendFile(imagePath)
  } else {
    res.status(404).json({ success: false, error: 'Image not found' })
  }
})

// Production: serve frontend static files
const clientDist = path.resolve(__dirname, '..', '..', 'client', 'dist')
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist))
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
