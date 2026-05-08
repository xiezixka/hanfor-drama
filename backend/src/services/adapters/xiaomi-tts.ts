/**
 * Xiaomi MiMo 语音合成（TTS）Adapter
 * API: POST /v1/chat/completions
 * 响应: choices[0].message.audio.data 为 base64 音频
 */
import type { AIConfig, ProviderRequest, TTSProviderAdapter } from './types.js'
import { joinProviderUrl } from './url.js'

interface TTSParams {
  text: string
  voice?: string
  speed?: number
  model?: string
  emotion?: string
}

const DEFAULT_MODEL = 'mimo-v2.5-tts'
const DEFAULT_VOICE = 'mimo_default'

const VOICE_ALIASES: Record<string, string> = {
  alloy: DEFAULT_VOICE,
  echo: '苏打',
  fable: '白桦',
  onyx: '白桦',
  nova: '冰糖',
  shimmer: '茉莉',
  default: DEFAULT_VOICE,
  default_zh: '冰糖',
  default_en: 'Mia',
}

export class XiaomiTTSAdapter implements TTSProviderAdapter {
  readonly provider = 'xiaomi'

  buildGenerateRequest(config: AIConfig, params: TTSParams): ProviderRequest {
    const url = joinProviderUrl(config.baseUrl, '/v1', '/chat/completions')
    const model = normalizeModel(params.model || config.model)
    const voice = normalizeVoice(params.voice)

    const instruction = buildStyleInstruction(params)
    const body = {
      model,
      messages: [
        { role: 'user', content: instruction },
        { role: 'assistant', content: params.text },
      ],
      audio: {
        format: 'wav',
        voice,
      },
    }

    return {
      url,
      method: 'POST',
      headers: {
        'api-key': config.apiKey,
        'Content-Type': 'application/json',
      },
      body,
    }
  }

  parseResponse(result: any) {
    const message = result?.choices?.[0]?.message
    const audio = message?.audio
    if (!audio?.data) {
      const errorMessage = result?.error?.message || result?.message || 'No audio data in Xiaomi TTS response'
      throw new Error(errorMessage)
    }

    return {
      audioBase64: audio.data,
      audioLength: 0,
      sampleRate: 24000,
      bitrate: 0,
      format: audio.format || 'wav',
      channel: 1,
    }
  }
}

function normalizeModel(model?: string) {
  return (model || DEFAULT_MODEL).trim().toLowerCase()
}

function normalizeVoice(voice?: string) {
  const raw = (voice || DEFAULT_VOICE).trim()
  return VOICE_ALIASES[raw.toLowerCase()] || raw
}

function buildStyleInstruction(params: TTSParams) {
  const parts = ['自然、清晰、有角色感的中文影视配音。']
  if (params.emotion) parts.push(`情绪：${params.emotion}。`)
  if (typeof params.speed === 'number') {
    const pace = params.speed > 1.05 ? '稍快' : params.speed < 0.95 ? '稍慢' : '正常'
    parts.push(`语速：${pace}。`)
  }
  return parts.join('')
}
