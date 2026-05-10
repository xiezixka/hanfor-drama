/**
 * Vidu 视频生成 Adapter
 * 端点: /ent/v2/img2video | /ent/v2/start-end2video | /ent/v2/reference2video
 * 认证: Authorization: Token {apiKey} (不是 Bearer!)
 * 特点: 借鉴 BigBanana 的路由方式，按输入类型选择单图、首尾帧或多参考图接口，并轮询 /ent/v2/tasks/{id}/creations
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

export class ViduVideoAdapter implements VideoProviderAdapter {
  provider = 'vidu'

  buildGenerateRequest(config: AIConfig, record: VideoGenerationRecord): ProviderRequest {
    const model = record.model || config.model || 'viduq3-turbo'
    const firstImage = record.firstFrameUrl || record.imageUrl
    const lastImage = record.lastFrameUrl
    const refs = parseReferenceImages(record.referenceImageUrls)
    const hasMultiRefs = record.referenceMode === 'multiple' && refs.length > 0
    const hasEndFrame = record.referenceMode === 'first_last' && !!firstImage && !!lastImage

    let endpoint = '/ent/v2/img2video'
    let images = firstImage ? [firstImage] : []

    if (hasMultiRefs) {
      endpoint = '/ent/v2/reference2video'
      images = Array.from(new Set([firstImage, ...refs].filter(Boolean))) as string[]
    } else if (hasEndFrame) {
      endpoint = '/ent/v2/start-end2video'
      images = [firstImage!, lastImage!]
    }

    if (images.length === 0) {
      throw new Error('Vidu 视频生成需要至少一张首帧或参考图')
    }

    const body: any = {
      model,
      images,
      prompt: record.prompt,
      duration: String(this.normalizeDuration(record.duration)),
      resolution: '1080p',
      bgm: false,
      audio: true,
      audio_type: 'all',
    }

    return {
      url: joinProviderUrl(config.baseUrl, '', endpoint),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${config.apiKey}`, // 注意: 不是 Bearer!
      },
      body,
    }
  }

  parseGenerateResponse(result: any): VideoGenResponse {
    const taskId = result?.task_id || result?.id || result?.data?.task_id || result?.data?.id
    if (taskId) {
      return { isAsync: true, taskId: String(taskId) }
    }
    // 同步返回（不太可能发生）
    const videoUrl = this.extractVideoUrl(result)
    if (videoUrl) {
      return { isAsync: false, videoUrl }
    }
    throw new Error('No task_id or video URL in Vidu response')
  }

  buildPollRequest(config: AIConfig, taskId: string): ProviderRequest {
    return {
      url: joinProviderUrl(config.baseUrl, '', `/ent/v2/tasks/${taskId}/creations`),
      method: 'GET',
      headers: {
        'Authorization': `Token ${config.apiKey}`,
      },
      body: undefined,
    }
  }

  parsePollResponse(result: any): VideoPollResponse {
    const status = String(result?.state || result?.status || result?.data?.state || result?.data?.status || '').toLowerCase()
    if (['success', 'succeeded', 'completed', 'done'].includes(status)) {
      const videoUrl = this.extractVideoUrl(result)
      if (!videoUrl) return { status: 'processing' }
      return { status: 'completed', videoUrl }
    }
    if (['failed', 'error', 'canceled', 'cancelled'].includes(status)) {
      return { status: 'failed', error: result?.err_message || result?.error?.message || result?.message || result?.msg || 'Vidu generation failed' }
    }
    return { status: 'processing' }
  }

  extractVideoUrl(result: any): string | null {
    return findVideoUrl(result)
  }

  /**
   * Vidu 回调状态映射
   * Webhook 路由使用此方法解析回调
   */
  static parseCallbackState(body: any): { status: 'completed' | 'failed'; videoUrl?: string; error?: string } {
    const state = body.state
    if (state === 'success') {
      return { status: 'completed', videoUrl: body.video_url }
    }
    if (state === 'failed') {
      return { status: 'failed', error: body.error || 'Vidu generation failed' }
    }
    return { status: 'failed', error: `Unknown state: ${state}` }
  }

  private normalizeDuration(duration?: number | null): number {
    const parsed = Math.round(Number(duration || 8))
    if (!Number.isFinite(parsed)) return 8
    return Math.min(16, Math.max(4, parsed))
  }
}

function parseReferenceImages(raw?: string | null): string[] {
  if (!raw) return []
  try {
    const refs = JSON.parse(raw)
    return Array.isArray(refs) ? refs.map((url) => String(url || '').trim()).filter(Boolean) : []
  } catch {
    return []
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
  for (const key of ['creations', 'data', 'task', 'result', 'video_url', 'videoUrl', 'url', 'download_url']) {
    const found = findVideoUrl(record[key])
    if (found) return found
  }
  for (const item of Object.values(record)) {
    const found = findVideoUrl(item)
    if (found) return found
  }
  return null
}
