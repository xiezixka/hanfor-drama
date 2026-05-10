import type {
  AIConfig,
  ProviderRequest,
  VideoGenerationRecord,
  VideoGenResponse,
  VideoPollResponse,
  VideoProviderAdapter,
} from './types.js'
import { joinProviderUrl } from './url.js'

export class VeoVideoAdapter implements VideoProviderAdapter {
  provider = 'veo'

  buildGenerateRequest(config: AIConfig, record: VideoGenerationRecord): ProviderRequest {
    const references = collectReferenceImages(record)
    const model = resolveVeoModel(record.model || config.model || 'veo', references.length > 0, record.aspectRatio)
    const content: any[] = [{ type: 'text', text: record.prompt || '' }]

    for (const url of references.slice(0, 4)) {
      content.push({ type: 'image_url', image_url: { url } })
    }

    return {
      url: joinProviderUrl(config.baseUrl, '/v1', '/chat/completions'),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: {
        model,
        messages: [{ role: 'user', content: references.length > 0 ? content : record.prompt || '' }],
        stream: false,
        temperature: 0.7,
      },
    }
  }

  parseGenerateResponse(result: any): VideoGenResponse {
    const videoUrl = this.extractVideoUrl(result)
    if (videoUrl) return { isAsync: false, videoUrl }

    const taskId = result?.id || result?.task_id || result?.data?.id || result?.data?.task_id
    if (taskId) return { isAsync: true, taskId: String(taskId) }

    throw new Error('Veo 响应中没有视频地址')
  }

  buildPollRequest(config: AIConfig, taskId: string): ProviderRequest {
    return {
      url: joinProviderUrl(config.baseUrl, '/v1', `/videos/${taskId}`),
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: undefined,
    }
  }

  parsePollResponse(result: any): VideoPollResponse {
    const videoUrl = this.extractVideoUrl(result)
    if (videoUrl) return { status: 'completed', videoUrl }

    const status = String(result?.status || result?.data?.status || '').toLowerCase()
    if (['failed', 'error', 'canceled', 'cancelled'].includes(status)) {
      return { status: 'failed', error: result?.error?.message || result?.message || 'Veo 视频生成失败' }
    }
    return { status: 'processing' }
  }

  extractVideoUrl(result: any): string | null {
    return findVideoUrl(result)
  }
}

function resolveVeoModel(model: string, hasReferenceImage: boolean, aspectRatio?: string | null): string {
  const normalized = model.trim().toLowerCase()
  const shouldAutoRoute = ['veo', 'veo-3.1', 'veo_3_1', 'veo3.1'].includes(normalized)
  if (!shouldAutoRoute) return model

  const orientation = aspectRatio === '9:16' ? 'portrait' : 'landscape'
  return hasReferenceImage
    ? `veo_3_1_i2v_s_fast_fl_${orientation}`
    : `veo_3_1_t2v_fast_${orientation}`
}

function collectReferenceImages(record: VideoGenerationRecord): string[] {
  const images: string[] = []
  const add = (value?: string | null) => {
    const url = String(value || '').trim()
    if (url && !images.includes(url)) images.push(url)
  }

  add(record.imageUrl)
  add(record.firstFrameUrl)
  add(record.lastFrameUrl)

  if (record.referenceImageUrls) {
    try {
      const refs = JSON.parse(record.referenceImageUrls)
      if (Array.isArray(refs)) refs.forEach((url) => add(url))
    } catch {}
  }

  return images
}

function findVideoUrl(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string') {
    const match = value.match(/https?:\/\/[^\s"')\]]+\.(mp4|mov|webm)(\?[^\s"')\]]*)?/i)
    if (match) return match[0]
    return null
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findVideoUrl(item)
      if (found) return found
    }
    return null
  }
  if (typeof value !== 'object') return null

  const record = value as Record<string, unknown>
  for (const key of ['content', 'result', 'data', 'message', 'video_url', 'videoUrl', 'url', 'download_url']) {
    const found = findVideoUrl(record[key])
    if (found) return found
  }
  for (const item of Object.values(record)) {
    const found = findVideoUrl(item)
    if (found) return found
  }
  return null
}
