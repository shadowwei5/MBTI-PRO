import { readFileSync } from 'node:fs'
import { generateVoiceover, getStoryTypeScript } from './generate-audio.js'
const data = JSON.parse(readFileSync('H:/ccwork/MBTI-PRO/video/work/ENFP/ENFP.json', 'utf8'))
const segments = getStoryTypeScript(data)
await generateVoiceover(segments, 'H:/ccwork/MBTI-PRO/video/work/ENFP/audio', 'ENFP')
