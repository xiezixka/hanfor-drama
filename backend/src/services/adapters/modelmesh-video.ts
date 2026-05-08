/**
 * Shengsuan/ModelMesh multimedia task adapter.
 * API: POST /v1/tasks/generations, then GET /v1/tasks/generations/{request_id}
 */
import type {
  VideoProviderAdapter,
  ProviderRequest,
  AIConfig,
  VideoGenerationRecord,
  VideoGenResponse,
  VideoPollResponse,
} from './types.js'
import { joinProviderUrl } from './url.js'

export class ModelMeshVideoAdapter implements VideoProviderAdapter {
  provider = 'modelmesh'

  buildGenerateRequest(config: AIConfig, record: VideoGenerationRecord): ProviderRequest {
    const content: any[] = [{ type: 'text', text: record.prompt || '' }]

    if (record.referenceMode === 'single' && record.imageUrl) {
      content.push({ type: 'image_url', role: 'first_frame', image_url: { url: record.imageUrl } })
    } else if (record.referenceMode === 'first_last') {
      if (record.firstFrameUrl) {
        content.push({ type: 'image_url', role: 'first_frame', image_url: { url: record.firstFrameUrl } })
      }
      if (record.lastFrameUrl) {
        content.push({ type: 'image_url', role: 'last_frame', image_url: { url: record.lastFrameUrl } })
      }
    } else if (record.referenceMode === 'multiple' && record.referenceImageUrls) {
      try {
        const refs = JSON.parse(record.referenceImageUrls)
        for (const url of refs) {
          content.push({ type: 'image_url', role: 'reference_image', image_url: { url } })
        }
      } catch {}
    }

    const body: any = {
      model: record.model || config.model || 'bytedance/doubao-seedance-2-0',
      content,
      generate_audio: true,
      service_tier: 'default',
      resolution: '720p',
      ratio: record.aspectRatio || '16:9',
      duration: this.normalizeDuration(record.duration),
    }

    return {
      url: joinProviderUrl(config.baseUrl, '/v1', '/tasks/generations'),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body,
    }
  }

  parseGenerateResponse(result: any): VideoGenResponse {
    const data = result?.data || result
    const requestId = data?.request_id || data?.id || result?.request_id || result?.id
    const videoUrl = this.extractVideoUrl(result)
    if (videoUrl) return { isAsync: false, videoUrl }
    if (requestId) return { isAsync: true, taskId: requestId }
    throw new Error('No request_id or video URL in response')
  }

  buildPollRequest(config: AIConfig, taskId: string): ProviderRequest {
    return {
      url: joinProviderUrl(config.baseUrl, '/v1', `/tasks/generations/${taskId}`),
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: undefined,
    }
  }

  parsePollResponse(result: any): VideoPollResponse {
    const data = result?.data || result
    const status = String(data?.status || result?.status || '').toUpperCase()
    const videoUrl = this.extractVideoUrl(result)

    if (videoUrl || status === 'COMPLETED' || status === 'SUCCEEDED' || status === 'SUCCESS') {
      if (videoUrl) return { status: 'completed', videoUrl }
      return { status: 'processing' }
    }
    if (status === 'FAILED' || status === 'CANCELLED' || status === 'TIMEOUT') {
      return { status: 'failed', error: data?.fail_reason || data?.error || result?.message || 'Video generation failed' }
    }
    return { status: 'processing' }
  }

  extractVideoUrl(result: any): string | null {
    return findVideoUrl(result)
  }

  private normalizeDuration(duration?: number | null): number {
    const parsed = Math.round(Number(duration || 5))
    if (!Number.isFinite(parsed)) return 5
    return Math.min(12, Math.max(4, parsed))
  }
}

function findVideoUrl(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string') {
    return /^https?:\/\/.+\.(mp4|mov|webm)(\?|#|$)/i.test(value) ? value : null
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
  const preferredKeys = ['video_url', 'videoUrl', 'url', 'file_url', 'fileUrl', 'output_url', 'outputUrl']
  for (const key of preferredKeys) {
    const candidate = record[key]
    if (typeof candidate === 'string') {
      const found = findVideoUrl(candidate)
      if (found) return found
    }
  }
  for (const candidate of Object.values(record)) {
    const found = findVideoUrl(candidate)
    if (found) return found
  }
  return null
}
