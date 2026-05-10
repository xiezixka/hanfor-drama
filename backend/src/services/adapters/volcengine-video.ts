/**
 * 火山引擎 Seedance 视频生成 Adapter
 * 端点: /api/v3/contents/generations/tasks (注意 /api/v3 前缀)
 * 响应: { id: "task-xxx" } -> 轮询获取状态
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

export class VolcEngineVideoAdapter implements VideoProviderAdapter {
  provider = 'volcengine'

  buildGenerateRequest(config: AIConfig, record: VideoGenerationRecord): ProviderRequest {
    const model = record.model || config.model || 'doubao-seedance-1-5-pro-251215'
    const useSeedance2References = /doubao-seedance-2-0|bigbanana-2/i.test(model)

    const content: any[] = [{ type: 'text', text: record.prompt || '' }]

    if (useSeedance2References) {
      for (const url of collectAllReferences(record).slice(0, 4)) {
        content.push({ type: 'image_url', image_url: { url }, role: 'reference_image' })
      }
    } else {
      // 添加参考图
      if (record.referenceMode === 'single' && record.imageUrl) {
        content.push({ type: 'image_url', image_url: { url: record.imageUrl } })
      } else if (record.referenceMode === 'first_last') {
        if (record.firstFrameUrl) {
          content.push({ type: 'image_url', image_url: { url: record.firstFrameUrl }, role: 'first_frame' })
        }
        if (record.lastFrameUrl) {
          content.push({ type: 'image_url', image_url: { url: record.lastFrameUrl }, role: 'last_frame' })
        }
      } else if (record.referenceMode === 'multiple' && record.referenceImageUrls) {
        for (const url of parseReferenceImages(record.referenceImageUrls)) {
          content.push({ type: 'image_url', image_url: { url } })
        }
      }
    }

    const body: any = {
      model,
      content,
      generate_audio: true,
      ratio: record.aspectRatio || 'adaptive',
      duration: this.normalizeDuration(record.duration, useSeedance2References),
      watermark: false,
    }

    return {
      url: joinProviderUrl(config.baseUrl, '/api/v3', '/contents/generations/tasks'),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body,
    }
  }

  parseGenerateResponse(result: any): VideoGenResponse {
    if (result.id) {
      return { isAsync: true, taskId: result.id }
    }
    // 同步返回
    const videoUrl = result.video_url || result.content?.video_url || result.data?.video_url
    if (videoUrl) {
      return { isAsync: false, videoUrl }
    }
    throw new Error('No task_id or video_url in response')
  }

  buildPollRequest(config: AIConfig, taskId: string): ProviderRequest {
    return {
      url: joinProviderUrl(config.baseUrl, '/api/v3', `/contents/generations/tasks/${taskId}`),
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: undefined,
    }
  }

  parsePollResponse(result: any): VideoPollResponse {
    const status = result.status
    if (status === 'succeeded') {
      const videoUrl = result.video_url || result.content?.video_url || result.data?.video_url
      return {
        status: 'completed',
        videoUrl,
      }
    }
    if (status === 'failed') {
      return { status: 'failed', error: result.error || 'Video generation failed' }
    }
    return { status: status || 'processing' }
  }

  extractVideoUrl(result: any): string | null {
    return result.video_url || result.content?.video_url || result.data?.video_url || null
  }

  private normalizeDuration(duration?: number | null, preferSeedance2Steps = false): number {
    const parsed = Math.round(Number(duration || 5))
    if (!Number.isFinite(parsed)) return 5
    if (preferSeedance2Steps) {
      return [5, 10, 15].reduce((best, value) => (
        Math.abs(value - parsed) < Math.abs(best - parsed) ? value : best
      ), 5)
    }
    return Math.min(12, Math.max(4, parsed))
  }
}

function collectAllReferences(record: VideoGenerationRecord): string[] {
  const refs: string[] = []
  const add = (value?: string | null) => {
    const url = String(value || '').trim()
    if (url && !refs.includes(url)) refs.push(url)
  }
  add(record.imageUrl)
  add(record.firstFrameUrl)
  add(record.lastFrameUrl)
  parseReferenceImages(record.referenceImageUrls).forEach(add)
  return refs
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
