/**
 * Xiaomi MiMo 图片生成 Adapter
 * 使用小米 OpenAI-compatible /chat/completions 通道，并兼容常见图片返回字段。
 */
import type {
  AIConfig,
  ImageGenerationRecord,
  ImageGenResponse,
  ImagePollResponse,
  ImageProviderAdapter,
  ProviderRequest,
} from './types.js'
import { joinProviderUrl } from './url.js'

const DEFAULT_MODEL = 'MiMo-V2.5'

export class XiaomiImageAdapter implements ImageProviderAdapter {
  provider = 'xiaomi'

  buildGenerateRequest(config: AIConfig, record: ImageGenerationRecord): ProviderRequest {
    const body: any = {
      model: normalizeModel(record.model || config.model || DEFAULT_MODEL),
      messages: [
        {
          role: 'user',
          content: buildPrompt(record),
        },
      ],
    }

    return {
      url: joinProviderUrl(config.baseUrl, '/v1', '/chat/completions'),
      method: 'POST',
      headers: {
        'api-key': config.apiKey,
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body,
    }
  }

  parseGenerateResponse(result: any): ImageGenResponse {
    const imageUrl = this.extractImageUrl(result)
    if (imageUrl) return { isAsync: false, imageUrl }
    if (this.extractImageBase64(result)) return { isAsync: false, imageUrl: undefined }

    const requestId = result?.request_id || result?.task_id || result?.id || result?.data?.request_id || result?.data?.id
    if (requestId) return { isAsync: true, taskId: requestId }

    const text = result?.choices?.[0]?.message?.content
    if (text) throw new Error(`小米模型返回了文本，但没有返回图片：${String(text).slice(0, 180)}`)
    throw new Error(result?.error?.message || result?.message || '小米图片接口没有返回图片数据')
  }

  buildPollRequest(config: AIConfig, taskId: string): ProviderRequest {
    return {
      url: joinProviderUrl(config.baseUrl, '/v1', `/tasks/generations/${taskId}`),
      method: 'GET',
      headers: {
        'api-key': config.apiKey,
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: undefined,
    }
  }

  parsePollResponse(result: any): ImagePollResponse {
    const status = String(result?.status || result?.data?.status || '').toLowerCase()
    const imageUrl = this.extractImageUrl(result)
    if (imageUrl) return { status: 'completed', imageUrl }
    if (status === 'failed' || status === 'error') return { status: 'failed', error: result?.error?.message || result?.message || 'Generation failed' }
    if (status === 'completed' || status === 'succeeded' || status === 'success') return { status: 'completed' }
    return { status: 'processing' }
  }

  extractImageUrl(result: any): string | null {
    return result?.data?.[0]?.url
      || result?.data?.image_url
      || result?.image_url
      || result?.url
      || result?.choices?.[0]?.message?.image_url?.url
      || result?.choices?.[0]?.message?.image_url
      || findImageUrl(result?.choices?.[0]?.message?.content)
      || null
  }

  extractImageBase64(result: any): { data: string; mimeType: string } | null {
    const data = result?.data?.[0]?.b64_json
      || result?.data?.b64_json
      || result?.choices?.[0]?.message?.image?.data
      || result?.choices?.[0]?.message?.images?.[0]?.data
    if (data) return { data: stripDataUrl(data), mimeType: mimeTypeFromDataUrl(data) || 'image/png' }

    const content = result?.choices?.[0]?.message?.content
    const dataUrl = findDataUrl(content)
    if (dataUrl) return { data: stripDataUrl(dataUrl), mimeType: mimeTypeFromDataUrl(dataUrl) || 'image/png' }
    return null
  }
}

function normalizeModel(model?: string | null) {
  return (model || DEFAULT_MODEL).trim()
}

function buildPrompt(record: ImageGenerationRecord) {
  const parts = [
    '请根据下面的描述生成一张图片，只返回图片结果。',
    `画面描述：${record.prompt || '生成一张图片'}`,
  ]
  if (record.size) parts.push(`图片尺寸或比例参考：${record.size}`)
  return parts.join('\n')
}

function findImageUrl(value: unknown) {
  if (typeof value !== 'string') return null
  const match = value.match(/https?:\/\/\S+\.(?:png|jpe?g|webp)(?:\?\S*)?/i)
  return match?.[0] || null
}

function findDataUrl(value: unknown) {
  if (typeof value !== 'string') return null
  const match = value.match(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/)
  return match?.[0] || null
}

function stripDataUrl(value: string) {
  return value.includes(',') ? value.split(',').pop() || value : value
}

function mimeTypeFromDataUrl(value: string) {
  return value.match(/^data:([^;]+);base64,/)?.[1]
}
