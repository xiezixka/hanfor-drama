<template>
  <div class="tool-page">
    <header class="tool-head">
      <div>
        <h1 class="page-title">语音项目</h1>
        <p class="page-subtitle">集中生成角色对白、旁白试听，也可以切换小米克隆相关模型。</p>
      </div>
      <button class="btn btn-primary" :disabled="generating || !canGenerate" @click="generateVoice">
        {{ generating ? '生成中...' : '生成语音' }}
      </button>
      <p v-if="!canGenerate && !generating" class="action-hint">请先填写配音文本</p>
    </header>

    <div class="tool-layout">
      <section class="card editor-panel">
        <div class="panel-head">
          <span class="panel-kicker">VOICE STUDIO</span>
          <h2>声音克隆与语音生成</h2>
        </div>

        <label class="field">
          <span class="field-label">配音文本</span>
          <textarea
            v-model="form.text"
            class="textarea script-input"
            placeholder="例如：今晚的风很安静，可我知道，故事才刚刚开始。"
          />
        </label>

        <div class="form-grid">
          <label class="field">
            <span class="field-label">音频服务</span>
            <BaseSelect v-model="form.config_id" :options="audioConfigOptions" placeholder="使用默认语音服务" searchable />
          </label>
          <label class="field">
            <span class="field-label">小米模型</span>
            <BaseSelect v-model="form.model" :options="modelOptions" placeholder="选择模型" searchable />
          </label>
        </div>

        <div class="form-grid">
          <label class="field">
            <span class="field-label">音色 / 克隆音色 ID</span>
            <input v-model="form.voice" class="input" placeholder="例如：mimo_default 或已克隆音色 ID" />
          </label>
          <label class="field">
            <span class="field-label">情绪</span>
            <BaseSelect v-model="form.emotion" :options="emotionOptions" placeholder="自然" />
          </label>
        </div>

        <label class="field">
          <span class="field-label">声音样本</span>
          <div class="upload-box" @click="audioInput?.click()">
            <input ref="audioInput" class="hidden-input" type="file" accept="audio/*" @change="uploadSample" />
            <span>{{ sampleName || '点击上传克隆参考音频' }}</span>
          </div>
        </label>
      </section>

      <section class="card result-panel">
        <div class="panel-head">
          <span class="panel-kicker">PREVIEW</span>
          <h2>试听结果</h2>
        </div>
        <div class="audio-preview">
          <audio v-if="audioUrl" :src="audioUrl" controls />
          <div v-else class="empty-preview">{{ generating ? '正在生成语音...' : '生成后会显示播放器' }}</div>
        </div>
        <div v-if="audioUrl" class="result-meta">
          <span class="tag tag-success">已生成</span>
          <span class="mono">{{ form.voice || 'mimo_default' }}</span>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { toast } from 'vue-sonner'
import BaseSelect from '~/components/BaseSelect.vue'
import { aiConfigAPI, audioAPI, uploadAPI } from '~/composables/useApi'

const form = ref({
  text: '',
  config_id: null,
  model: 'MiMo-V2.5-TTS',
  voice: 'mimo_default',
  emotion: '',
  speed: 1,
  sample_path: '',
})
const audioConfigs = ref([])
const generating = ref(false)
const audioUrl = ref('')
const audioInput = ref(null)
const sampleName = ref('')

const modelOptions = [
  { label: 'MiMo-V2.5-TTS', value: 'MiMo-V2.5-TTS' },
  { label: 'MiMo-V2.5-TTS-VoiceClone', value: 'MiMo-V2.5-TTS-VoiceClone' },
  { label: 'MiMo-V2.5-TTS-VoiceDesign', value: 'MiMo-V2.5-TTS-VoiceDesign' },
  { label: 'MiMo-V2-TTS', value: 'MiMo-V2-TTS' },
]
const emotionOptions = [
  { label: '自然', value: '' },
  { label: '温柔', value: '温柔' },
  { label: '坚定', value: '坚定' },
  { label: '紧张', value: '紧张' },
  { label: '悲伤', value: '悲伤' },
  { label: '开心', value: '开心' },
]
const audioConfigOptions = computed(() => [
  { label: '默认语音服务', value: null },
  ...audioConfigs.value.map((item) => ({
    label: `${item.name || item.provider} · ${firstModel(item.model)}`,
    value: item.id,
  })),
])
const canGenerate = computed(() => !!form.value.text.trim())

function firstModel(model) {
  try {
    const models = JSON.parse(model || '[]')
    return models[0] || '默认模型'
  } catch {
    return model || '默认模型'
  }
}

async function loadConfigs() {
  try {
    const res = await aiConfigAPI.list('audio')
    const items = Array.isArray(res) ? res : (res.items || [])
    audioConfigs.value = items.filter((item) => item.is_active ?? item.isActive ?? true)
  } catch (err) {
    toast.error(err.message)
  }
}

async function uploadSample(event) {
  const file = event.target.files?.[0]
  if (!file) return
  try {
    const res = await uploadAPI.audio(file)
    form.value.sample_path = res.path
    sampleName.value = file.name
    toast.success('声音样本已上传')
  } catch (err) {
    toast.error(err.message)
  } finally {
    event.target.value = ''
  }
}

async function generateVoice() {
  if (!canGenerate.value) return
  generating.value = true
  audioUrl.value = ''
  try {
    const res = await audioAPI.tts({
      text: form.value.text.trim(),
      config_id: form.value.config_id || undefined,
      model: form.value.model,
      voice: form.value.voice || 'mimo_default',
      emotion: form.value.emotion || undefined,
      speed: form.value.speed,
      sample_path: form.value.sample_path || undefined,
    })
    audioUrl.value = res.audio_url || (res.path ? `/${res.path}` : '')
    toast.success('语音已生成')
  } catch (err) {
    toast.error(err.message)
  } finally {
    generating.value = false
  }
}

onMounted(loadConfigs)
</script>

<style scoped>
.tool-page { flex: 1; overflow: auto; padding: 32px 48px; }
.tool-head { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 28px; }
.action-hint { color: var(--text-3); font-size: 12px; margin-left: auto; }
.page-title { font-size: 30px; }
.page-subtitle { color: var(--text-2); margin-top: 4px; }
.tool-layout { display: grid; grid-template-columns: minmax(360px, 560px) minmax(340px, 1fr); gap: 20px; align-items: start; }
.editor-panel, .result-panel { padding: 20px; border-radius: var(--radius); }
.panel-head { margin-bottom: 18px; }
.panel-kicker { display: block; color: var(--text-3); font-size: 11px; font-weight: 700; letter-spacing: 0.12em; margin-bottom: 4px; }
.field { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
.field-label { font-size: 13px; font-weight: 700; color: var(--text-1); }
.script-input { min-height: 190px; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.upload-box { min-height: 72px; border: 1px dashed var(--border-strong); border-radius: var(--radius); background: var(--bg-1); display: flex; align-items: center; justify-content: center; color: var(--text-3); cursor: pointer; padding: 14px; text-align: center; }
.hidden-input { display: none; }
.audio-preview { min-height: 220px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--bg-1); display: flex; align-items: center; justify-content: center; padding: 20px; }
.audio-preview audio { width: 100%; }
.empty-preview { color: var(--text-3); }
.result-meta { display: flex; align-items: center; gap: 10px; margin-top: 14px; color: var(--text-2); }
@media (max-width: 900px) {
  .tool-page { padding: 24px; }
  .tool-layout { grid-template-columns: 1fr; }
  .form-grid { grid-template-columns: 1fr; }
}
</style>
