import { Hono } from 'hono'
import { success, badRequest } from '../utils/response.js'
import { generateTTS } from '../services/tts-generation.js'
import { logTaskError, logTaskPayload, logTaskStart, logTaskSuccess } from '../utils/task-logger.js'

const app = new Hono()

// POST /audio/tts
app.post('/tts', async (c) => {
  const body = await c.req.json()
  const text = String(body.text || '').trim()
  if (!text) return badRequest(c, 'text is required')

  try {
    logTaskStart('AudioAPI', 'tts', {
      configId: body.config_id,
      voice: body.voice,
      model: body.model,
      textLength: text.length,
    })
    logTaskPayload('AudioAPI', 'tts body', body)
    const path = await generateTTS({
      text,
      voice: body.voice || 'mimo_default',
      model: body.model,
      speed: typeof body.speed === 'number' ? body.speed : undefined,
      emotion: body.emotion,
      configId: normalizeId(body.config_id),
    })
    logTaskSuccess('AudioAPI', 'tts', { path, voice: body.voice, model: body.model })
    return success(c, { audio_url: `/${path}`, path, voice: body.voice || 'mimo_default', model: body.model || null })
  } catch (err: any) {
    logTaskError('AudioAPI', 'tts', { error: err.message })
    return badRequest(c, err.message)
  }
})

export default app

function normalizeId(value: unknown): number | undefined {
  if (value == null || value === '') return undefined
  if (typeof value === 'object' && value && 'value' in value) return normalizeId((value as { value?: unknown }).value)
  const id = Number(value)
  return Number.isFinite(id) && id > 0 ? id : undefined
}
