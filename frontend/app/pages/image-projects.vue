<template>
  <div class="tool-page">
    <header class="tool-head">
      <div>
        <h1 class="page-title">图片项目</h1>
        <p class="page-subtitle">独立生成角色图、场景图、海报和分镜参考图。</p>
      </div>
      <button class="btn btn-primary" :disabled="generating || !canGenerate" @click="generateImage">
        {{ generating ? '生成中...' : '生成图片' }}
      </button>
      <p v-if="!canGenerate && !generating" class="action-hint">请先填写画面描述</p>
    </header>

    <div class="tool-layout">
      <section class="card editor-panel">
        <div class="panel-head">
          <span class="panel-kicker">IMAGE STUDIO</span>
          <h2>图片生成</h2>
        </div>

        <label class="field">
          <span class="field-label">画面描述</span>
          <textarea
            v-model="form.prompt"
            class="textarea prompt-input"
            placeholder="例如：都市夜晚，年轻女性站在便利店门口，霓虹灯反射在雨水路面，电影感，细节丰富"
          />
        </label>

        <div class="form-grid">
          <label class="field">
            <span class="field-label">图片比例</span>
            <BaseSelect v-model="form.size" :options="sizeOptions" placeholder="选择比例" />
          </label>
          <label class="field">
            <span class="field-label">图片服务</span>
            <BaseSelect v-model="form.config_id" :options="imageConfigOptions" placeholder="使用默认图片服务" searchable />
          </label>
        </div>

        <label class="field">
          <span class="field-label">参考图</span>
          <div class="upload-box" @click="imageInput?.click()">
            <input ref="imageInput" class="hidden-input" type="file" accept="image/*" @change="uploadReference" />
            <img v-if="referencePreview" :src="referencePreview" alt="参考图" />
            <span v-else>点击上传参考图</span>
          </div>
        </label>

        <div class="progress-panel">
          <div class="progress-head">
            <div>
              <span class="panel-kicker">PROGRESS</span>
              <h3>处理进度</h3>
            </div>
            <span class="tag" :class="statusClass">{{ currentTask ? statusText : '未开始' }}</span>
          </div>
          <div class="progress-track">
            <span class="progress-bar" :style="{ width: `${progressPercent}%` }"></span>
          </div>
          <div class="progress-grid">
            <div v-for="step in progressSteps" :key="step.key" class="progress-step" :class="step.state">
              <span class="step-dot"></span>
              <div>
                <strong>{{ step.title }}</strong>
                <small>{{ step.desc }}</small>
              </div>
            </div>
          </div>
          <div class="progress-meta">
            <span>任务：{{ currentTask?.id ? `#${currentTask.id}` : '尚未创建' }}</span>
            <span>服务：{{ activeConfigLabel }}</span>
            <span>等待：{{ elapsedText }}</span>
          </div>
          <p v-if="progressHint" class="progress-hint">{{ progressHint }}</p>
        </div>
      </section>

      <section class="card result-panel">
        <div class="panel-head">
          <span class="panel-kicker">RESULT</span>
          <h2>生成结果</h2>
        </div>
        <div class="preview-box" :class="{ loading: generating }">
          <img v-if="resultImage" :src="resultImage" alt="生成图片" />
          <div v-else class="empty-preview">
            <span>{{ generating ? '正在生成图片...' : '生成后会显示在这里' }}</span>
          </div>
        </div>
        <div v-if="currentTask" class="result-meta">
          <span class="tag" :class="statusClass">{{ statusText }}</span>
          <span class="mono">#{{ currentTask.id }}</span>
        </div>
        <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
      </section>
    </div>
  </div>
</template>

<script setup>
import { toast } from 'vue-sonner'
import BaseSelect from '~/components/BaseSelect.vue'
import { aiConfigAPI, imageAPI, uploadAPI } from '~/composables/useApi'

const form = ref({
  prompt: '',
  size: '1024x1024',
  config_id: null,
  reference_images: [],
})
const imageInput = ref(null)
const referencePreview = ref('')
const imageConfigs = ref([])
const generating = ref(false)
const currentTask = ref(null)
const resultImage = ref('')
const elapsedSeconds = ref(0)
const taskStartedAt = ref(null)
let pollTimer = null
let elapsedTimer = null

const sizeOptions = [
  { label: '方图 1:1', value: '1024x1024' },
  { label: '竖图 9:16', value: '1024x1792' },
  { label: '横图 16:9', value: '1792x1024' },
]
const imageConfigOptions = computed(() => [
  { label: '默认图片服务', value: null },
  ...imageConfigs.value.map((item) => ({
    label: `${item.name || item.provider} · ${firstModel(item.model)}`,
    value: item.id,
  })),
])
const canGenerate = computed(() => !!form.value.prompt.trim())
const statusText = computed(() => {
  const status = currentTask.value?.status
  if (status === 'completed') return '已完成'
  if (status === 'failed') return '失败'
  if (status === 'processing') return '处理中'
  return '排队中'
})
const statusClass = computed(() => currentTask.value?.status === 'completed' ? 'tag-success' : currentTask.value?.status === 'failed' ? 'tag-error' : 'tag-info')
const errorMessage = computed(() => currentTask.value?.error_msg || currentTask.value?.errorMsg || '')
const activeConfigLabel = computed(() => {
  if (!form.value.config_id) return imageConfigOptions.value[0]?.label || '默认图片服务'
  return imageConfigOptions.value.find((item) => item.value === form.value.config_id)?.label || '已选图片服务'
})
const elapsedText = computed(() => currentTask.value ? `${elapsedSeconds.value} 秒` : '-')
const progressPercent = computed(() => {
  if (!currentTask.value) return 0
  if (currentTask.value.status === 'completed') return 100
  if (currentTask.value.status === 'failed') return 100
  return Math.min(92, 18 + elapsedSeconds.value * 0.8)
})
const progressHint = computed(() => {
  if (!currentTask.value) return '填写画面描述后点击生成，会在这里显示处理进度。'
  if (currentTask.value.status === 'completed') return '图片已生成完成。'
  if (currentTask.value.status === 'failed') return errorMessage.value || '生成失败，请换一个图片服务或稍后重试。'
  if (elapsedSeconds.value > 90) return '模型返回时间偏长，仍在等待结果；超过约 2 分钟会显示超时原因。'
  return '图片任务已提交，正在等待模型返回。'
})
const progressSteps = computed(() => {
  const status = currentTask.value?.status
  return [
    {
      key: 'create',
      title: '创建任务',
      desc: currentTask.value?.id ? `已创建 #${currentTask.value.id}` : '等待开始',
      state: currentTask.value ? 'done' : 'idle',
    },
    {
      key: 'request',
      title: '提交模型',
      desc: currentTask.value ? activeConfigLabel.value : '等待选择服务',
      state: currentTask.value ? 'done' : 'idle',
    },
    {
      key: 'wait',
      title: '等待返回',
      desc: status === 'processing' ? `已等待 ${elapsedSeconds.value} 秒` : status === 'completed' ? '模型已返回' : status === 'failed' ? '模型未完成' : '等待任务',
      state: status === 'processing' ? 'active' : status === 'completed' ? 'done' : status === 'failed' ? 'error' : 'idle',
    },
    {
      key: 'save',
      title: '保存结果',
      desc: resultImage.value ? '已保存到本地' : status === 'failed' ? '未保存' : '等待图片',
      state: resultImage.value ? 'done' : status === 'failed' ? 'error' : 'idle',
    },
  ]
})

function firstModel(model) {
  try {
    const models = JSON.parse(model || '[]')
    return models[0] || '默认模型'
  } catch {
    return model || '默认模型'
  }
}

function toAssetUrl(path) {
  if (!path) return ''
  if (/^https?:\/\//.test(path) || path.startsWith('/')) return path
  return `/${path}`
}

function startElapsedTimer(startedAt = Date.now()) {
  taskStartedAt.value = startedAt
  updateElapsed()
  if (elapsedTimer) window.clearInterval(elapsedTimer)
  elapsedTimer = window.setInterval(updateElapsed, 1000)
}

function updateElapsed() {
  if (!taskStartedAt.value) {
    elapsedSeconds.value = 0
    return
  }
  elapsedSeconds.value = Math.max(0, Math.floor((Date.now() - taskStartedAt.value) / 1000))
}

function stopElapsedTimer() {
  if (elapsedTimer) window.clearInterval(elapsedTimer)
  elapsedTimer = null
}

async function loadConfigs() {
  try {
    const res = await aiConfigAPI.list('image')
    const items = Array.isArray(res) ? res : (res.items || [])
    imageConfigs.value = items.filter((item) => item.is_active ?? item.isActive ?? true)
    if (!form.value.config_id && imageConfigs.value[0]?.id) {
      form.value.config_id = imageConfigs.value[0].id
    }
  } catch (err) {
    toast.error(err.message)
  }
}

async function uploadReference(event) {
  const file = event.target.files?.[0]
  if (!file) return
  try {
    const res = await uploadAPI.image(file)
    form.value.reference_images = [res.path]
    referencePreview.value = res.url || toAssetUrl(res.path)
    toast.success('参考图已上传')
  } catch (err) {
    toast.error(err.message)
  } finally {
    event.target.value = ''
  }
}

async function generateImage() {
  if (!canGenerate.value) return
  stopPolling()
  stopElapsedTimer()
  generating.value = true
  resultImage.value = ''
  currentTask.value = null
  elapsedSeconds.value = 0
  try {
    const payload = {
      prompt: form.value.prompt.trim(),
      size: form.value.size,
      config_id: form.value.config_id || undefined,
      reference_images: form.value.reference_images,
      image_type: 'image_project',
    }
    const record = await imageAPI.generate(payload)
    currentTask.value = record
    startElapsedTimer(record.created_at || record.createdAt ? new Date(record.created_at || record.createdAt).getTime() : Date.now())
    updateResult(record)
    if (record.status !== 'completed' && record.status !== 'failed') pollImage(record.id)
    toast.success('图片任务已创建')
  } catch (err) {
    toast.error(err.message)
  } finally {
    generating.value = false
  }
}

function updateResult(record) {
  currentTask.value = record
  if (!taskStartedAt.value && (record?.created_at || record?.createdAt)) {
    startElapsedTimer(new Date(record.created_at || record.createdAt).getTime())
  }
  const path = record?.local_path || record?.localPath || record?.image_url || record?.imageUrl
  if (path) resultImage.value = toAssetUrl(path)
  if (record?.status === 'completed' || record?.status === 'failed') stopElapsedTimer()
}

function pollImage(id) {
  pollTimer = window.setTimeout(async () => {
    try {
      const record = await imageAPI.get(id)
      updateResult(record)
      if (record?.status !== 'completed' && record?.status !== 'failed') pollImage(id)
    } catch (err) {
      toast.error(err.message)
    }
  }, 3000)
}

function stopPolling() {
  if (pollTimer) window.clearTimeout(pollTimer)
  pollTimer = null
}

onMounted(loadConfigs)
onBeforeUnmount(() => {
  stopPolling()
  stopElapsedTimer()
})
</script>

<style scoped>
.tool-page { flex: 1; overflow: auto; padding: 32px 48px; }
.tool-head { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 28px; }
.action-hint { color: var(--text-3); font-size: 12px; margin-left: auto; }
.page-title { font-size: 30px; }
.page-subtitle { color: var(--text-2); margin-top: 4px; }
.tool-layout { display: grid; grid-template-columns: minmax(360px, 520px) minmax(360px, 1fr); gap: 20px; align-items: start; }
.editor-panel, .result-panel { padding: 20px; border-radius: var(--radius); }
.panel-head { margin-bottom: 18px; }
.panel-kicker { display: block; color: var(--text-3); font-size: 11px; font-weight: 700; letter-spacing: 0.12em; margin-bottom: 4px; }
.field { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
.field-label { font-size: 13px; font-weight: 700; color: var(--text-1); }
.prompt-input { min-height: 190px; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.upload-box { min-height: 116px; border: 1px dashed var(--border-strong); border-radius: var(--radius); background: var(--bg-1); display: flex; align-items: center; justify-content: center; color: var(--text-3); cursor: pointer; overflow: hidden; }
.upload-box img { width: 100%; height: 180px; object-fit: cover; }
.hidden-input { display: none; }
.progress-panel { margin-top: 18px; padding: 16px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--bg-1); }
.progress-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.progress-head h3 { font-size: 16px; }
.progress-track { height: 8px; border-radius: 99px; background: var(--bg-3); overflow: hidden; margin-bottom: 14px; }
.progress-bar { display: block; height: 100%; border-radius: inherit; background: var(--accent-gradient); transition: width 0.35s var(--ease-out); }
.progress-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.progress-step { display: flex; gap: 8px; align-items: flex-start; min-height: 48px; padding: 9px; border-radius: var(--radius); background: var(--bg-0); color: var(--text-2); border: 1px solid transparent; }
.progress-step strong { display: block; color: var(--text-1); font-size: 12px; line-height: 1.35; }
.progress-step small { display: block; margin-top: 2px; font-size: 11px; color: var(--text-3); line-height: 1.35; }
.step-dot { width: 8px; height: 8px; margin-top: 5px; border-radius: 50%; background: var(--bg-3); flex: 0 0 auto; }
.progress-step.done .step-dot { background: var(--success); }
.progress-step.active { border-color: rgba(76,125,255,0.22); background: rgba(76,125,255,0.06); }
.progress-step.active .step-dot { background: var(--accent); box-shadow: 0 0 0 4px var(--accent-bg); }
.progress-step.error .step-dot { background: var(--error); }
.progress-meta { display: flex; flex-wrap: wrap; gap: 8px 14px; margin-top: 12px; font-size: 11px; color: var(--text-2); }
.progress-hint { margin-top: 10px; color: var(--text-2); font-size: 12px; line-height: 1.55; }
.preview-box { aspect-ratio: 1 / 1; min-height: 420px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--bg-1); overflow: hidden; display: flex; align-items: center; justify-content: center; }
.preview-box img { width: 100%; height: 100%; object-fit: contain; background: #fff; }
.empty-preview { color: var(--text-3); }
.result-meta { display: flex; align-items: center; gap: 10px; margin-top: 14px; color: var(--text-2); }
.error-message { margin-top: 12px; color: var(--error); font-size: 12px; line-height: 1.6; word-break: break-word; }
@media (max-width: 900px) {
  .tool-page { padding: 24px; }
  .tool-layout { grid-template-columns: 1fr; }
  .form-grid { grid-template-columns: 1fr; }
}
</style>
