/**
 * 角色音色分配 Agent 工具
 */
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { db, schema } from '../../db/index.js'
import { eq } from 'drizzle-orm'
import { now } from '../../utils/response.js'
import { logTaskProgress, logTaskSuccess } from '../../utils/task-logger.js'

export function createVoiceTools(episodeId: number, dramaId: number) {
  function getEpisodeAudioProvider() {
    const [episode] = db.select().from(schema.episodes).where(eq(schema.episodes.id, episodeId)).all()
    if (!episode?.audioConfigId) return null
    const [config] = db.select().from(schema.aiServiceConfigs).where(eq(schema.aiServiceConfigs.id, episode.audioConfigId)).all()
    return config?.provider || null
  }

  const getCharacters = createTool({
    id: 'get_characters',
    description: 'Get all characters for the current drama with their current voice assignments.',
    inputSchema: z.object({}),
    execute: async () => {
      const chars = db.select().from(schema.characters)
        .where(eq(schema.characters.dramaId, dramaId)).all()
      const payload = {
        characters: chars.map(c => ({
          id: c.id,
          name: c.name,
          role: c.role,
          personality: c.personality,
          description: c.description,
          current_voice: c.voiceStyle || '未分配',
        })),
      }
      logTaskSuccess('VoiceTool', 'get-characters', { episodeId, dramaId, count: payload.characters.length })
      return payload
    },
  })

  const listVoices = createTool({
    id: 'list_voices',
    description: 'List all available voice options for TTS.',
    inputSchema: z.object({}),
    execute: async () => {
      const provider = getEpisodeAudioProvider() || 'minimax'
      const rows = db.select().from(schema.aiVoices).where(eq(schema.aiVoices.provider, provider)).all()
      const voices = rows.length ? rows.map(v => {
        const desc = v.description ? JSON.parse(v.description) : []
        return {
          id: v.voiceId,
          name: v.voiceName,
          gender: inferGender(v.voiceName, desc),
          traits: Array.isArray(desc) && desc.length ? desc.slice(0, 2).join('、') : `${v.language || '多语言'}音色`,
          suitable_for: Array.isArray(desc) && desc.length > 2 ? desc.slice(2).join('、') : `${v.language || '通用'}角色`,
          language: v.language,
          provider,
        }
      }) : fallbackVoices(provider)

      const payload = {
        provider,
        voices,
        instruction: '根据角色的性别、性格、年龄来匹配最合适的音色，并且只能从当前集音频配置可用的音色列表中选择。',
      }
      logTaskSuccess('VoiceTool', 'list-voices', { episodeId, provider, count: payload.voices.length })
      return payload
    },
  })

  const assignVoice = createTool({
    id: 'assign_voice',
    description: 'Assign a voice to a character.',
    inputSchema: z.object({
      character_id: z.number().describe('Character ID'),
      voice_id: z.string().describe('Voice ID from list_voices'),
      reason: z.string().optional().describe('Why this voice fits'),
    }),
    execute: async ({ character_id, voice_id, reason }) => {
      const provider = getEpisodeAudioProvider() || 'minimax'
      logTaskProgress('VoiceTool', 'assign-begin', { episodeId, dramaId, characterId: character_id, voiceId: voice_id, provider, reason })
      db.update(schema.characters)
        .set({ voiceStyle: voice_id, voiceProvider: provider, voiceSampleUrl: null, updatedAt: now() })
        .where(eq(schema.characters.id, character_id))
        .run()
      logTaskSuccess('VoiceTool', 'assign-complete', { episodeId, characterId: character_id, voiceId: voice_id, provider })
      return { message: `Assigned voice "${voice_id}" to character ${character_id}`, reason }
    },
  })

  return { getCharacters, listVoices, assignVoice }
}

function fallbackVoices(provider: string) {
  if (provider === 'xiaomi') {
    return [
      { id: 'mimo_default', name: 'MiMo 默认', gender: '中性', traits: '自然清晰', suitable_for: '旁白、通用角色', language: '中文/英文', provider },
      { id: '冰糖', name: '冰糖', gender: '女声', traits: '清亮甜美', suitable_for: '年轻女性、活泼角色', language: '中文', provider },
      { id: '茉莉', name: '茉莉', gender: '女声', traits: '温柔自然', suitable_for: '女主、旁白', language: '中文', provider },
      { id: '苏打', name: '苏打', gender: '男声', traits: '年轻干净', suitable_for: '年轻男性、轻松对白', language: '中文', provider },
      { id: '白桦', name: '白桦', gender: '男声', traits: '沉稳清晰', suitable_for: '成熟男性、叙述', language: '中文', provider },
      { id: 'Mia', name: 'Mia', gender: '女声', traits: '自然英文', suitable_for: '英文旁白、女性角色', language: '英文', provider },
      { id: 'Chloe', name: 'Chloe', gender: '女声', traits: '明亮英文', suitable_for: '英文女声、活泼角色', language: '英文', provider },
      { id: 'Milo', name: 'Milo', gender: '男声', traits: '自然英文', suitable_for: '英文男声、年轻角色', language: '英文', provider },
      { id: 'Dean', name: 'Dean', gender: '男声', traits: '稳重英文', suitable_for: '英文旁白、成熟角色', language: '英文', provider },
    ]
  }

  return [
    { id: 'alloy', name: 'Alloy', gender: '中性', traits: '平衡自然', suitable_for: '旁白、通用', language: '多语言', provider },
    { id: 'echo', name: 'Echo', gender: '男声', traits: '低沉稳重', suitable_for: '成熟男性、旁白', language: '多语言', provider },
    { id: 'fable', name: 'Fable', gender: '男声', traits: '温暖富有表现力', suitable_for: '年轻男性、故事叙述', language: '多语言', provider },
    { id: 'onyx', name: 'Onyx', gender: '男声', traits: '深沉有力', suitable_for: '权威角色、反派', language: '多语言', provider },
    { id: 'nova', name: 'Nova', gender: '女声', traits: '温柔甜美', suitable_for: '年轻女性、女主', language: '多语言', provider },
    { id: 'shimmer', name: 'Shimmer', gender: '女声', traits: '明亮活泼', suitable_for: '活泼女性、少女', language: '多语言', provider },
  ]
}

function inferGender(name: string, desc: unknown) {
  const description = Array.isArray(desc) ? desc.join(' ') : ''
  const text = `${name} ${description}`
  if (/[男|青年|大爷|学长|boy|man|male]/i.test(text)) return '男声'
  if (/[女|少女|御姐|奶奶|girl|woman|female]/i.test(text)) return '女声'
  return '中性'
}
