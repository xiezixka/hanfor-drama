import { Hono } from 'hono'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { success, badRequest, now } from '../utils/response.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_ROOT = process.env.DATA_PATH || path.resolve(__dirname, '../../../data')
const STATIC_ROOT = process.env.STORAGE_PATH || path.join(DATA_ROOT, 'static')
const app = new Hono()

type AssetItem = {
  id: string
  type: 'image' | 'audio' | 'video'
  title: string
  url: string
  local_path: string
  source: string
  provider?: string | null
  model?: string | null
  prompt?: string | null
  created_at?: string | null
  drama_id?: number | null
  drama_title?: string | null
  episode_id?: number | null
  episode_number?: number | null
  episode_title?: string | null
}

type AssetContext = Pick<AssetItem, 'drama_id' | 'drama_title' | 'episode_id' | 'episode_number' | 'episode_title'>

app.get('/', async (c) => {
  const type = c.req.query('type')
  const search = (c.req.query('search') || '').trim().toLowerCase()
  const sort = c.req.query('sort') || 'newest'
  const page = Math.max(1, Number(c.req.query('page') || 1))
  const limit = clamp(Number(c.req.query('limit') || 24), 1, 100)
  const allItems = collectAssets()
  const counts = {
    all: allItems.length,
    image: allItems.filter(item => item.type === 'image').length,
    audio: allItems.filter(item => item.type === 'audio').length,
    video: allItems.filter(item => item.type === 'video').length,
  }
  const filteredItems = allItems
    .filter(item => !type || item.type === type)
    .filter(item => !search || assetSearchText(item).includes(search))
    .sort((a, b) => compareAssets(a, b, sort))
  const total = filteredItems.length
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * limit
  const items = filteredItems.slice(start, start + limit)

  return success(c, {
    items,
    counts,
    pagination: {
      page: safePage,
      limit,
      total,
      total_pages: totalPages,
    },
  })
})

app.delete('/:id', async (c) => {
  const id = c.req.param('id')
  try {
    deleteAsset(id)
    return success(c)
  } catch (error: any) {
    return badRequest(c, error.message || '删除失败')
  }
})

function collectAssets() {
  const seen = new Set<string>()
  const items: AssetItem[] = []
  const context = buildContext()

  const push = (item: AssetItem) => {
    if (!item.local_path && !item.url) return
    const key = item.local_path || item.url
    if (seen.has(key)) return
    seen.add(key)
    items.push(item)
  }

  for (const row of db.select().from(schema.imageGenerations).all()) {
    const assetPath = row.localPath || row.imageUrl || row.minioUrl || ''
    if (!assetPath || row.status === 'failed') continue
    push({
      id: `image-generation-${row.id}`,
      type: 'image',
      title: imageTitle(row.imageType, row.frameType, row.id),
      url: toPublicUrl(assetPath),
      local_path: normalizeRelativePath(assetPath),
      source: '图片生成',
      provider: row.provider,
      model: row.model,
      prompt: row.prompt,
      created_at: row.completedAt || row.createdAt,
      ...context.fromImage(row),
    })
  }

  for (const row of db.select().from(schema.characters).all()) {
    const assetPath = row.imageUrl || row.localPath || ''
    if (!assetPath || row.deletedAt) continue
    push({
      id: `character-image-${row.id}`,
      type: 'image',
      title: `${row.name || '角色'} 角色图`,
      url: toPublicUrl(assetPath),
      local_path: normalizeRelativePath(assetPath),
      source: '短剧角色',
      prompt: row.appearance || row.description || '',
      created_at: row.updatedAt || row.createdAt,
      ...context.fromDrama(row.dramaId),
    })
  }

  for (const row of db.select().from(schema.scenes).all()) {
    const assetPath = row.imageUrl || row.localPath || ''
    if (!assetPath || row.deletedAt) continue
    push({
      id: `scene-image-${row.id}`,
      type: 'image',
      title: `${row.location || '场景'} 场景图`,
      url: toPublicUrl(assetPath),
      local_path: normalizeRelativePath(assetPath),
      source: '短剧场景',
      prompt: row.prompt,
      created_at: row.updatedAt || row.createdAt,
      ...context.fromDramaEpisode(row.dramaId, row.episodeId),
    })
  }

  for (const row of db.select().from(schema.storyboards).all()) {
    if (row.ttsAudioUrl && !row.deletedAt) {
      push({
        id: `storyboard-audio-${row.id}`,
        type: 'audio',
        title: `镜头 ${row.storyboardNumber || row.id} 配音`,
        url: toPublicUrl(row.ttsAudioUrl),
        local_path: normalizeRelativePath(row.ttsAudioUrl),
        source: '短剧配音',
        prompt: row.dialogue || row.description || '',
        created_at: row.updatedAt || row.createdAt,
        ...context.fromStoryboard(row),
      })
    }

    for (const [field, title] of [
      [row.composedImage, '合成图'],
      [row.firstFrameImage, '首帧图'],
      [row.lastFrameImage, '尾帧图'],
    ] as const) {
      if (!field || row.deletedAt) continue
      push({
        id: `storyboard-${title}-${row.id}`,
        type: 'image',
        title: `镜头 ${row.storyboardNumber || row.id} ${title}`,
        url: toPublicUrl(field),
        local_path: normalizeRelativePath(field),
        source: '短剧镜头',
        prompt: row.imagePrompt || row.videoPrompt || '',
        created_at: row.updatedAt || row.createdAt,
        ...context.fromStoryboard(row),
      })
    }

    if (row.videoUrl && !row.deletedAt) {
      push({
        id: `storyboard-video-${row.id}`,
        type: 'video',
        title: `镜头 ${row.storyboardNumber || row.id} 视频`,
        url: toPublicUrl(row.videoUrl),
        local_path: normalizeRelativePath(row.videoUrl),
        source: '短剧视频',
        prompt: row.videoPrompt || row.description || '',
        created_at: row.updatedAt || row.createdAt,
        ...context.fromStoryboard(row),
      })
    }
  }

  for (const row of db.select().from(schema.videoGenerations).all()) {
    const assetPath = row.localPath || row.videoUrl || row.minioUrl || ''
    if (!assetPath || row.status === 'failed' || row.deletedAt) continue
    push({
      id: `video-generation-${row.id}`,
      type: 'video',
      title: `生成视频 ${row.id}`,
      url: toPublicUrl(assetPath),
      local_path: normalizeRelativePath(assetPath),
      source: '视频生成',
      provider: row.provider,
      model: row.model,
      prompt: row.prompt,
      created_at: row.completedAt || row.createdAt,
      ...context.fromVideo(row),
    })
  }

  for (const row of db.select().from(schema.characters).all()) {
    if (!row.voiceSampleUrl || row.deletedAt) continue
    push({
      id: `character-voice-${row.id}`,
      type: 'audio',
      title: `${row.name || '角色'} 声音样本`,
      url: toPublicUrl(row.voiceSampleUrl),
      local_path: normalizeRelativePath(row.voiceSampleUrl),
      source: '角色声音',
      provider: row.voiceProvider,
      prompt: row.voiceStyle || row.description || '',
      created_at: row.updatedAt || row.createdAt,
      ...context.fromDrama(row.dramaId),
    })
  }

  for (const file of listMediaFiles(path.join(STATIC_ROOT, 'audio'), 'static/audio')) {
    push({
      id: `audio-file-${file.relativePath}`,
      type: 'audio',
      title: fileTitle('语音文件', file.createdAt),
      url: `/${file.relativePath}`,
      local_path: file.relativePath,
      source: '语音项目',
      created_at: file.createdAt,
    })
  }

  for (const file of listMediaFiles(path.join(STATIC_ROOT, 'videos'), 'static/videos')) {
    push({
      id: `video-file-${file.relativePath}`,
      type: 'video',
      title: fileTitle('视频文件', file.createdAt),
      url: `/${file.relativePath}`,
      local_path: file.relativePath,
      source: '视频文件',
      created_at: file.createdAt,
    })
  }

  return items
}

function buildContext() {
  const dramas = new Map(db.select().from(schema.dramas).all().map(row => [row.id, row]))
  const episodes = new Map(db.select().from(schema.episodes).all().map(row => [row.id, row]))
  const storyboards = new Map(db.select().from(schema.storyboards).all().map(row => [row.id, row]))
  const characters = new Map(db.select().from(schema.characters).all().map(row => [row.id, row]))
  const scenes = new Map(db.select().from(schema.scenes).all().map(row => [row.id, row]))

  const fromDramaEpisode = (dramaId?: number | null, episodeId?: number | null): AssetContext => {
    const episode = episodeId ? episodes.get(episodeId) : null
    const drama = dramas.get(dramaId || episode?.dramaId || 0)
    return {
      drama_id: drama?.id || null,
      drama_title: drama?.title || null,
      episode_id: episode?.id || null,
      episode_number: episode?.episodeNumber || null,
      episode_title: episode?.title || null,
    }
  }

  const fromStoryboard = (storyboard?: { episodeId?: number | null } | null) => {
    const episode = storyboard?.episodeId ? episodes.get(storyboard.episodeId) : null
    return fromDramaEpisode(episode?.dramaId, episode?.id)
  }

  return {
    fromDrama: (dramaId?: number | null) => fromDramaEpisode(dramaId, null),
    fromDramaEpisode,
    fromStoryboard,
    fromImage: (row: typeof schema.imageGenerations.$inferSelect) => {
      if (row.storyboardId) return fromStoryboard(storyboards.get(row.storyboardId))
      if (row.characterId) return fromDrama(characters.get(row.characterId)?.dramaId)
      if (row.sceneId) {
        const scene = scenes.get(row.sceneId)
        return fromDramaEpisode(scene?.dramaId || row.dramaId, scene?.episodeId)
      }
      return fromDrama(row.dramaId)
    },
    fromVideo: (row: typeof schema.videoGenerations.$inferSelect) => {
      if (row.storyboardId) return fromStoryboard(storyboards.get(row.storyboardId))
      return fromDrama(row.dramaId)
    },
  }

  function fromDrama(dramaId?: number | null) {
    return fromDramaEpisode(dramaId, null)
  }
}

function deleteAsset(id: string) {
  if (id.startsWith('image-generation-')) {
    const rowId = numericId(id, 'image-generation-')
    const [row] = db.select().from(schema.imageGenerations).where(eq(schema.imageGenerations.id, rowId)).all()
    deleteLocalFile(row?.localPath || '')
    db.delete(schema.imageGenerations).where(eq(schema.imageGenerations.id, rowId)).run()
    return
  }

  if (id.startsWith('video-generation-')) {
    const rowId = numericId(id, 'video-generation-')
    const [row] = db.select().from(schema.videoGenerations).where(eq(schema.videoGenerations.id, rowId)).all()
    deleteLocalFile(row?.localPath || '')
    db.update(schema.videoGenerations)
      .set({ deletedAt: now() })
      .where(eq(schema.videoGenerations.id, rowId))
      .run()
    return
  }

  if (id.startsWith('character-image-')) {
    const rowId = numericId(id, 'character-image-')
    const [row] = db.select().from(schema.characters).where(eq(schema.characters.id, rowId)).all()
    deleteLocalFile(row?.localPath || row?.imageUrl || '')
    db.update(schema.characters)
      .set({ imageUrl: null, localPath: null, updatedAt: now() })
      .where(eq(schema.characters.id, rowId))
      .run()
    return
  }

  if (id.startsWith('scene-image-')) {
    const rowId = numericId(id, 'scene-image-')
    const [row] = db.select().from(schema.scenes).where(eq(schema.scenes.id, rowId)).all()
    deleteLocalFile(row?.localPath || row?.imageUrl || '')
    db.update(schema.scenes)
      .set({ imageUrl: null, localPath: null, updatedAt: now() })
      .where(eq(schema.scenes.id, rowId))
      .run()
    return
  }

  if (id.startsWith('storyboard-audio-')) {
    const rowId = numericId(id, 'storyboard-audio-')
    const [row] = db.select().from(schema.storyboards).where(eq(schema.storyboards.id, rowId)).all()
    deleteLocalFile(row?.ttsAudioUrl || '')
    db.update(schema.storyboards)
      .set({ ttsAudioUrl: null, updatedAt: now() })
      .where(eq(schema.storyboards.id, rowId))
      .run()
    return
  }

  if (id.startsWith('storyboard-video-')) {
    const rowId = numericId(id, 'storyboard-video-')
    const [row] = db.select().from(schema.storyboards).where(eq(schema.storyboards.id, rowId)).all()
    deleteLocalFile(row?.videoUrl || '')
    db.update(schema.storyboards)
      .set({ videoUrl: null, updatedAt: now() })
      .where(eq(schema.storyboards.id, rowId))
      .run()
    return
  }

  for (const [prefix, field] of [
    ['storyboard-合成图-', 'composedImage'],
    ['storyboard-首帧图-', 'firstFrameImage'],
    ['storyboard-尾帧图-', 'lastFrameImage'],
  ] as const) {
    if (!id.startsWith(prefix)) continue
    const rowId = numericId(id, prefix)
    const [row] = db.select().from(schema.storyboards).where(eq(schema.storyboards.id, rowId)).all()
    deleteLocalFile(row?.[field] || '')
    db.update(schema.storyboards)
      .set({ [field]: null, updatedAt: now() })
      .where(eq(schema.storyboards.id, rowId))
      .run()
    return
  }

  if (id.startsWith('character-voice-')) {
    const rowId = numericId(id, 'character-voice-')
    const [row] = db.select().from(schema.characters).where(eq(schema.characters.id, rowId)).all()
    deleteLocalFile(row?.voiceSampleUrl || '')
    db.update(schema.characters)
      .set({ voiceSampleUrl: null, updatedAt: now() })
      .where(eq(schema.characters.id, rowId))
      .run()
    return
  }

  if (id.startsWith('audio-file-')) {
    deleteLocalFile(id.slice('audio-file-'.length))
    return
  }

  if (id.startsWith('video-file-')) {
    deleteLocalFile(id.slice('video-file-'.length))
    return
  }

  throw new Error('不支持删除这个资产')
}

function numericId(id: string, prefix: string) {
  const value = Number(id.slice(prefix.length))
  if (!Number.isFinite(value) || value <= 0) throw new Error('资产编号无效')
  return value
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.floor(value)))
}

function compareAssets(a: AssetItem, b: AssetItem, sort: string) {
  if (sort === 'oldest') return timeValue(a.created_at) - timeValue(b.created_at)
  if (sort === 'name') return String(a.title || '').localeCompare(String(b.title || ''), 'zh-CN')
  if (sort === 'type') {
    const byType = typeLabel(a.type).localeCompare(typeLabel(b.type), 'zh-CN')
    return byType || timeValue(b.created_at) - timeValue(a.created_at)
  }
  return timeValue(b.created_at) - timeValue(a.created_at)
}

function timeValue(value?: string | null) {
  const time = new Date(value || 0).getTime()
  return Number.isNaN(time) ? 0 : time
}

function assetSearchText(item: AssetItem) {
  return [
    item.title,
    item.prompt,
    item.source,
    item.provider,
    item.model,
    item.drama_title,
    item.episode_title,
    item.episode_number ? `第${item.episode_number}集` : '',
    typeLabel(item.type),
  ].filter(Boolean).join(' ').toLowerCase()
}

function typeLabel(type: AssetItem['type']) {
  return type === 'image' ? '图片' : type === 'video' ? '视频' : '声音'
}

function deleteLocalFile(relativePath: string) {
  if (!relativePath || /^https?:\/\//.test(relativePath)) return
  const normalized = normalizeRelativePath(relativePath)
  if (!normalized.startsWith('static/')) return
  const fullPath = path.resolve(DATA_ROOT, normalized)
  const dataRoot = path.resolve(DATA_ROOT)
  if (!fullPath.startsWith(dataRoot)) return
  if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath)
}

function imageTitle(imageType?: string | null, frameType?: string | null, id?: number) {
  if (imageType === 'character') return '角色图片'
  if (imageType === 'scene') return '场景图片'
  if (frameType === 'first') return '首帧图片'
  if (frameType === 'last') return '尾帧图片'
  return `生成图片 ${id || ''}`.trim()
}

function toPublicUrl(value: string) {
  if (/^https?:\/\//.test(value)) return value
  const normalized = normalizeRelativePath(value)
  return normalized ? `/${normalized}` : ''
}

function normalizeRelativePath(value: string) {
  return value.replace(/^\/+/, '')
}

function listMediaFiles(dir: string, publicPrefix: string) {
  if (!fs.existsSync(dir)) return []
  const allowed = new Set(['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.mp4', '.mov', '.webm'])
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(entry => entry.isFile() && allowed.has(path.extname(entry.name).toLowerCase()))
    .map(entry => {
      const fullPath = path.join(dir, entry.name)
      const stat = fs.statSync(fullPath)
      return {
        name: entry.name.replace(/\.[^.]+$/, ''),
        relativePath: `${publicPrefix}/${entry.name}`,
        createdAt: stat.birthtime.toISOString(),
      }
    })
}

function fileTitle(prefix: string, createdAt: string) {
  const date = new Date(createdAt)
  const stamp = Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
  return stamp ? `${prefix} ${stamp}` : prefix
}

export default app
