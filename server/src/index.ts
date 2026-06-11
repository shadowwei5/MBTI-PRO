import express from 'express'
import cors from 'cors'
import { PrismaClient } from '@prisma/client'
import { questionRoutes } from './routes/questions.js'
import { resultRoutes } from './routes/results.js'
import { recordRoutes } from './routes/records.js'

export const prisma = new PrismaClient()

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:4173'] }))
app.use(express.json())

app.use('/api/questions', questionRoutes)
app.use('/api/results', resultRoutes)
app.use('/api/records', recordRoutes)

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
