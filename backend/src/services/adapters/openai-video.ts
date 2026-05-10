import type {
  AIConfig,
  ProviderRequest,
  VideoGenerationRecord,
  VideoGenResponse,
  VideoPollResponse,
  VideoProviderAdapter,
} from './types.js'
import { joinProviderUrl } from './url.js'

export class OpenAIVideoAdapter implements VideoProviderAdapter {
  provider = 'openai'

  buildGenerateRequest(config: AIConfig, record: VideoGenerationRecord): ProviderRequest {
    const model = record.model || config.model || 'sora-2'
    const referenceImages = collectReferenceImages(record)

    if (isViduModel(model)) {
      return {
        url: joinProviderUrl(config.baseUrl, '/v1', '/videos'),
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: {
          model,
          prompt: record.prompt || '',
          duration: normalizeDuration(record.duration),
          images: referenceImages.slice(0, 2),
          metadata: {
            resolution: '1080p',
            audio: true,
            audio_type: 'all',
          },
        },
      }
    }

    const body = new FormData()
    body.append('model', model)
    body.append('prompt', record.prompt || '')
    body.append('seconds', String(normalizeSoraDuration(record.duration)))
    body.append('size', sizeFromAspectRatio(record.aspectRatio))

    const firstReference = referenceImages.find((url) => url.startsWith('data:image/'))
    if (firstReference) {
      const image = dataUrlToBlob(firstReference)
      if (image) body.append('input_reference', image.blob, `reference${image.ext}`)
    }

    return {
      url: joinProviderUrl(config.baseUrl, '/v1', '/videos'),
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body,
    }
  }

  parseGenerateResponse(result: any): VideoGenResponse {
    const videoUrl = findVideoUrl(result)
    if (videoUrl) return { isAsync: false, videoUrl }

    const taskId = result?.id || result?.task_id || result?.data?.id || result?.data?.task_id
    if (taskId) return { isAsync: true, taskId: String(taskId) }

    throw new Error('创建视频任务失败：未返回任务 ID')
  }

  buildPollRequest(config: AIConfig, taskId: string): ProviderRequest {
    return {
      url: joinProviderUrl(config.baseUrl, '/v1', `/videos/${taskId}`),
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: undefined,
    }
  }

  parsePollResponse(result: any): VideoPollResponse {
    const status = String(result?.status || result?.data?.status || '').toLowerCase()
    const directUrl = findVideoUrl(result)

    if (directUrl || ['completed', 'succeeded', 'success', 'done'].includes(status)) {
      if (directUrl) return { status: 'completed', videoUrl: directUrl }
      const videoId = resolveDownloadId(result)
      if (videoId) return { status: 'completed', videoUrl: `openai-video:${videoId}` }
      return { status: 'processing' }
    }

    if (['failed', 'error', 'canceled', 'cancelled'].includes(status)) {
      return { status: 'failed', error: formatError(result) }
    }

    return { status: 'processing' }
  }

  extractVideoUrl(result: any): string | null {
    return findVideoUrl(result)
  }

  buildDownloadRequest(config: AIConfig, videoUrl: string): ProviderRequest | null {
    if (!videoUrl.startsWith('openai-video:')) return null
    const videoId = videoUrl.slice('openai-video:'.length)
    return {
      url: joinProviderUrl(config.baseUrl, '/v1', `/videos/${videoId}/content`),
      method: 'GET',
      headers: {
        'Accept': '*/*',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: undefined,
    }
  }
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

function dataUrlToBlob(dataUrl: string): { blob: Blob; ext: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return null

  const mimeType = match[1]
  const ext = mimeType.includes('png') ? '.png' : mimeType.includes('webp') ? '.webp' : '.jpg'
  const bytes = new Uint8Array(Buffer.from(match[2], 'base64'))
  return { blob: new Blob([bytes], { type: mimeType }), ext }
}

function sizeFromAspectRatio(aspectRatio?: string | null): string {
  if (aspectRatio === '9:16') return '720x1280'
  if (aspectRatio === '1:1') return '720x720'
  return '1280x720'
}

function normalizeDuration(duration?: number | null): number {
  const parsed = Math.round(Number(duration || 8))
  if (!Number.isFinite(parsed)) return 8
  return Math.min(16, Math.max(4, parsed))
}

function normalizeSoraDuration(duration?: number | null): number {
  const parsed = normalizeDuration(duration)
  return [4, 8, 12].reduce((best, value) => (
    Math.abs(value - parsed) < Math.abs(best - parsed) ? value : best
  ), 8)
}

function isViduModel(model: string): boolean {
  return /^vidu/i.test(model)
}

function resolveDownloadId(result: any): string | null {
  const candidates = [
    result?.video?.id,
    result?.video_id,
    result?.output_video,
    result?.result?.video_id,
    result?.result?.file_id,
    result?.result?.id,
    ...(Array.isArray(result?.outputs) ? result.outputs.map((item: any) => typeof item === 'string' ? item : item?.id) : []),
    result?.id,
  ]

  const preferred = candidates.find((item) => typeof item === 'string' && item.startsWith('video_'))
  const fallback = candidates.find((item) => typeof item === 'string' && item.trim())
  return preferred || fallback || null
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
  for (const key of ['result_url', 'video_url', 'videoUrl', 'download_url', 'url', 'file_url', 'output_url']) {
    const found = findVideoUrl(record[key])
    if (found) return found
  }
  for (const item of Object.values(record)) {
    const found = findVideoUrl(item)
    if (found) return found
  }
  return null
}

function formatError(result: any): string {
  const err = result?.error || result?.data?.error
  if (typeof err === 'string') return err
  return err?.message || err?.code || result?.message || result?.msg || '视频生成失败'
}
