<template>
  <div class="page" v-if="drama">
    <!-- Header -->
    <div class="page-head">
      <div class="head-left">
        <button class="back-btn" @click="navigateTo('/')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
          返回
        </button>
        <div class="head-info">
          <h1 class="page-title">{{ drama.title }}</h1>
          <div class="page-meta">
            <span v-if="drama.style" class="style-chip">{{ drama.style }}</span>
            <span v-if="drama.style" class="meta-divider"></span>
            <span class="meta-item">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              {{ drama.characters?.length || 0 }} 角色
            </span>
            <span class="meta-divider"></span>
            <span class="meta-item">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg>
              {{ drama.scenes?.length || 0 }} 场景
            </span>
          </div>
        </div>
      </div>
      <button class="btn btn-primary" @click="openAddEpisode">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        添加集
      </button>
    </div>

    <!-- Episode List -->
    <div class="section-label">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <rect x="2" y="2" width="20" height="20" rx="2.5"/>
        <line x1="7" y1="8" x2="7" y2="16"/>
        <line x1="10" y1="8" x2="10" y2="16"/>
        <line x1="13" y1="8" x2="13" y2="16"/>
        <line x1="16" y1="8" x2="16" y2="16"/>
      </svg>
      剧集列表
    </div>

    <div class="ep-grid">
      <div
        v-for="(ep, i) in drama.episodes"
        :key="ep.id"
        class="card ep-card"
        :style="{ animationDelay: `${i * 0.05}s` }"
        @click="navigateTo(`/drama/${drama.id}/episode/${ep.episode_number || ep.episodeNumber}`)"
      >
        <div class="ep-number">E{{ String(ep.episode_number || ep.episodeNumber).padStart(2, '0') }}</div>
        <div class="ep-body">
          <span class="ep-title">{{ ep.title }}</span>
          <div class="ep-status">
            <span :class="['status-dot', hasScript(ep) ? 'dot-ready' : 'dot-pending']"></span>
            <span class="status-text">{{ hasScript(ep) ? '已完成剧本' : '待编写' }}</span>
            <span v-if="ep.duration" class="ep-duration">{{ ep.duration }}s</span>
          </div>
        </div>
        <div class="ep-arrow">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>
      </div>

      <!-- Empty episode state -->
      <div v-if="!drama.episodes?.length" class="card ep-empty">
        <div class="ep-empty-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="16"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
        </div>
        <p>点击上方「添加集」创建第一集</p>
      </div>
    </div>

    <div v-if="hasProjectAssets" class="project-assets">
      <section v-if="drama.characters?.length" class="asset-section">
        <div class="section-label compact">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          角色形象
          <span class="asset-count">{{ drama.characters.length }}</span>
        </div>
        <div class="asset-grid">
          <article v-for="c in drama.characters" :key="c.id" class="card asset-card">
            <div class="asset-thumb">
              <img v-if="assetImage(c)" :src="'/' + assetImage(c)" :alt="`${c.name} 角色形象`" />
              <div v-else class="asset-empty">角色</div>
            </div>
            <div class="asset-copy">
              <div class="asset-name">{{ c.name }}</div>
              <div class="asset-meta">{{ c.role || '角色' }}</div>
            </div>
            <button class="btn btn-sm asset-upload-btn" :disabled="isProjectUploading('character', c.id)" @click="startProjectAssetUpload('character', c.id)">
              <Upload :size="12" /> {{ isProjectUploading('character', c.id) ? '上传中' : '上传形象' }}
            </button>
          </article>
        </div>
      </section>

      <section v-if="drama.scenes?.length" class="asset-section">
        <div class="section-label compact">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          场景图片
          <span class="asset-count">{{ drama.scenes.length }}</span>
        </div>
        <div class="asset-grid">
          <article v-for="s in drama.scenes" :key="s.id" class="card asset-card scene">
            <div class="asset-thumb scene">
              <img v-if="assetImage(s)" :src="'/' + assetImage(s)" :alt="`${s.location} 场景图片`" />
              <div v-else class="asset-empty">场景</div>
            </div>
            <div class="asset-copy">
              <div class="asset-name">{{ s.location }}</div>
              <div class="asset-meta">{{ s.time || '未设时间' }}</div>
            </div>
            <button class="btn btn-sm asset-upload-btn" :disabled="isProjectUploading('scene', s.id)" @click="startProjectAssetUpload('scene', s.id)">
              <Upload :size="12" /> {{ isProjectUploading('scene', s.id) ? '上传中' : '上传场景' }}
            </button>
          </article>
        </div>
      </section>
    </div>

    <input ref="projectAssetUploadInput" class="sr-only" type="file" accept="image/*" @change="handleProjectAssetUploadChange" />

    <div v-if="addDialog" class="dialog-mask" @click.self="addDialog = false">
      <div class="card dialog">
        <div class="dialog-head">
          <div class="dialog-head-copy">
            <div class="dialog-kicker">Episode Setup</div>
            <div class="dialog-title-row">
              <div class="dialog-title">创建新集</div>
              <span class="dialog-badge">配置将锁定</span>
            </div>
            <div class="dialog-sub">为这一集预先锁定图片、视频和音频生成服务。创建后，这些生成链路将始终跟随当前集配置。</div>
          </div>
          <button class="back-btn" @click="addDialog = false">取消</button>
        </div>
        <div class="dialog-summary">
          <div class="summary-chip">图片 · {{ imageConfigs.length }} 可选</div>
          <div class="summary-chip">视频 · {{ videoConfigs.length }} 可选</div>
          <div class="summary-chip">音频 · {{ audioConfigs.length }} 可选</div>
        </div>
        <div class="dialog-body">
          <div class="dialog-section">
            <div class="dialog-section-head">
              <span class="dialog-section-title">基础信息</span>
              <span class="dialog-section-copy">这一项只影响显示名称，不影响生成配置</span>
            </div>
            <label class="field">
              <span class="field-label">标题</span>
              <input v-model="newEpisodeTitle" class="input" placeholder="默认按集数自动命名" />
              <span class="field-hint">留空时会自动按集数命名，例如“第 3 集”。</span>
            </label>
          </div>

          <div class="dialog-section">
            <div class="dialog-section-head">
              <span class="dialog-section-title">生成配置</span>
              <span class="dialog-section-copy">创建后不可更改，建议在这里一次性选对</span>
            </div>
            <div class="config-grid">
              <label class="config-card">
                <span class="config-card-kicker">IMAGE</span>
                <span class="field-label">图片配置</span>
                <BaseSelect v-model="newEpisodeImageConfigId" :options="imageConfigOptions" placeholder="选择图片服务" searchable />
              </label>
              <label class="config-card">
                <span class="config-card-kicker">VIDEO</span>
                <span class="field-label">视频配置</span>
                <BaseSelect v-model="newEpisodeVideoConfigId" :options="videoConfigOptions" placeholder="选择视频服务" searchable />
              </label>
              <label class="config-card">
                <span class="config-card-kicker">AUDIO</span>
                <span class="field-label">音频配置</span>
                <BaseSelect v-model="newEpisodeAudioConfigId" :options="audioConfigOptions" placeholder="选择音频服务" searchable />
              </label>
            </div>
          </div>
        </div>
        <div class="dialog-foot">
          <div class="dialog-foot-copy">创建后，工作台中的图片、视频、音频生成入口都会锁定到当前集。</div>
          <button class="btn btn-primary" :disabled="creatingEpisode || !canCreateEpisode" @click="addEpisode">
            {{ creatingEpisode ? '创建中...' : '创建并锁定配置' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { toast } from 'vue-sonner'
import { Upload } from 'lucide-vue-next'
import { aiConfigAPI, characterAPI, dramaAPI, episodeAPI, sceneAPI, uploadAPI } from '~/composables/useApi'

const route = useRoute()
const drama = ref(null)
const dramaId = Number(route.params.id)
const addDialog = ref(false)
const creatingEpisode = ref(false)
const newEpisodeTitle = ref('')
const imageConfigs = ref([])
const videoConfigs = ref([])
const audioConfigs = ref([])
const newEpisodeImageConfigId = ref(null)
const newEpisodeVideoConfigId = ref(null)
const newEpisodeAudioConfigId = ref(null)
const projectAssetUploadInput = ref(null)
const projectAssetUploadTarget = ref(null)
const projectUploadingKey = ref('')

function hasScript(ep) { return !!(ep.script_content || ep.scriptContent) }
const hasProjectAssets = computed(() => !!(drama.value?.characters?.length || drama.value?.scenes?.length))

function assetImage(item) {
  return item?.image_url || item?.imageUrl || ''
}

function projectAssetKey(type, id) {
  return `${type}:${id}`
}

function isProjectUploading(type, id) {
  return projectUploadingKey.value === projectAssetKey(type, id)
}

function startProjectAssetUpload(type, id) {
  projectAssetUploadTarget.value = { type, id }
  if (projectAssetUploadInput.value) {
    projectAssetUploadInput.value.value = ''
    projectAssetUploadInput.value.click()
  }
}

async function handleProjectAssetUploadChange(event) {
  const file = event.target.files?.[0]
  const target = projectAssetUploadTarget.value
  if (!file || !target) return
  if (!file.type.startsWith('image/')) {
    toast.warning('请选择图片文件')
    return
  }

  projectUploadingKey.value = projectAssetKey(target.type, target.id)
  try {
    const uploaded = await uploadAPI.image(file)
    const imagePath = uploaded.path || String(uploaded.url || '').replace(/^\/+/, '')
    if (!imagePath) throw new Error('上传成功，但没有返回图片路径')

    if (target.type === 'character') {
      await characterAPI.update(target.id, { image_url: imagePath, local_path: imagePath })
      const char = drama.value?.characters?.find(c => c.id === target.id)
      if (char) Object.assign(char, { image_url: imagePath, imageUrl: imagePath, local_path: imagePath, localPath: imagePath })
      toast.success('角色形象已上传')
    } else {
      await sceneAPI.update(target.id, { image_url: imagePath, local_path: imagePath, status: 'completed' })
      const scene = drama.value?.scenes?.find(s => s.id === target.id)
      if (scene) Object.assign(scene, { image_url: imagePath, imageUrl: imagePath, local_path: imagePath, localPath: imagePath, status: 'completed' })
      toast.success('场景图片已上传')
    }
    await load()
  } catch (e) {
    toast.error(e.message)
  } finally {
    projectUploadingKey.value = ''
    projectAssetUploadTarget.value = null
    if (event.target) event.target.value = ''
  }
}

function configLabel(config) {
  if (!config) return ''
  let modelName = ''
  try { const m = JSON.parse(config.model || '[]'); modelName = Array.isArray(m) ? (m[0] || '') : (m || '') } catch { modelName = config.model || '' }
  return modelName ? `${config.name} · ${modelName} (${config.provider})` : `${config.name} (${config.provider})`
}

const imageConfigOptions = computed(() => imageConfigs.value.map(c => ({ label: configLabel(c), value: c.id })))
const videoConfigOptions = computed(() => videoConfigs.value.map(c => ({ label: configLabel(c), value: c.id })))
const audioConfigOptions = computed(() => audioConfigs.value.map(c => ({ label: configLabel(c), value: c.id })))
const canCreateEpisode = computed(() => !!(newEpisodeImageConfigId.value && newEpisodeVideoConfigId.value && newEpisodeAudioConfigId.value))

async function load() {
  try {
    drama.value = await dramaAPI.get(dramaId)
  } catch (e) {
    toast.error(e.message)
  }
}

async function loadConfigs() {
  try {
    const [imgs, vids, auds] = await Promise.all([
      aiConfigAPI.list('image'),
      aiConfigAPI.list('video'),
      aiConfigAPI.list('audio'),
    ])
    imageConfigs.value = imgs || []
    videoConfigs.value = vids || []
    audioConfigs.value = auds || []
    if (!newEpisodeImageConfigId.value && imageConfigs.value.length) newEpisodeImageConfigId.value = imageConfigs.value[0].id
    if (!newEpisodeVideoConfigId.value && videoConfigs.value.length) newEpisodeVideoConfigId.value = videoConfigs.value[0].id
    if (!newEpisodeAudioConfigId.value && audioConfigs.value.length) newEpisodeAudioConfigId.value = audioConfigs.value[0].id
  } catch (e) {
    toast.error(e.message)
  }
}

function openAddEpisode() {
  newEpisodeTitle.value = ''
  addDialog.value = true
}

async function addEpisode() {
  try {
    creatingEpisode.value = true
    await episodeAPI.create({
      drama_id: dramaId,
      title: newEpisodeTitle.value || undefined,
      image_config_id: newEpisodeImageConfigId.value,
      video_config_id: newEpisodeVideoConfigId.value,
      audio_config_id: newEpisodeAudioConfigId.value,
    })
    toast.success('已添加新集')
    addDialog.value = false
    load()
  } catch (e) {
    toast.error(e.message)
  } finally {
    creatingEpisode.value = false
  }
}

onMounted(() => { load(); loadConfigs() })
</script>

<style scoped>
.page {
  padding: 28px 48px 40px;
  overflow-y: auto;
  height: 100%;
  animation: fadeUp 0.35s var(--ease-out) both;
}

.page-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 24px;
  gap: 20px;
}
.head-left { display: flex; align-items: flex-start; gap: 12px; }
.head-info { display: flex; flex-direction: column; gap: 8px; }

.back-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 7px 12px; font-size: 13px; font-weight: 500;
  border: 1px solid var(--border); border-radius: var(--radius);
  background: var(--bg-0); color: var(--text-2);
  cursor: pointer; transition: all 0.18s var(--ease-out);
  box-shadow: var(--shadow-xs);
}
.back-btn:hover { background: var(--bg-hover); border-color: var(--border-strong); color: var(--text-0); }

.page-title {
  font-family: var(--font-display);
  font-size: 26px; font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.page-meta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.style-chip {
  font-size: 11px; font-weight: 500;
  padding: 2px 8px;
  background: var(--accent-bg); color: var(--accent-text);
  border-radius: 99px; border: 1px solid rgba(184,120,20,0.12);
}
.meta-divider { width: 3px; height: 3px; border-radius: 50%; background: var(--text-3); }
.meta-item {
  display: flex; align-items: center; gap: 5px;
  font-size: 12px; color: var(--text-2);
}

/* Section label */
.section-label {
  display: flex; align-items: center; gap: 7px;
  font-size: 11px; font-weight: 700;
  color: var(--text-3); letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 12px;
}

/* Episode Grid */
.ep-grid { display: flex; flex-direction: column; gap: 10px; max-width: 760px; }

.ep-card {
  display: flex; align-items: center; gap: 16px;
  padding: 14px 16px;
  cursor: pointer;
  animation: fadeUp 0.35s var(--ease-out) both;
  transition: transform 0.18s var(--ease-out), box-shadow 0.18s var(--ease-out), border-color 0.18s;
}
.ep-card:hover {
  border-color: var(--accent);
  box-shadow: var(--shadow);
  transform: translateX(4px);
}

.ep-number {
  width: 44px; height: 44px; flex-shrink: 0;
  border-radius: var(--radius);
  background: var(--bg-2);
  border: 1px solid var(--border);
  display: flex; align-items: center; justify-content: center;
  font-family: var(--font-mono);
  font-size: 12px; font-weight: 700;
  color: var(--text-2);
  transition: all 0.18s;
}
.ep-card:hover .ep-number {
  background: var(--accent-bg);
  border-color: rgba(184,120,20,0.2);
  color: var(--accent);
}

.ep-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px; }
.ep-title { font-size: 14px; font-weight: 600; color: var(--text-0); }
.ep-status { display: flex; align-items: center; gap: 6px; }
.status-dot {
  width: 6px; height: 6px; border-radius: 50%;
}
.dot-ready { background: var(--success); }
.dot-pending { background: var(--text-3); }
.status-text { font-size: 11px; color: var(--text-3); }
.ep-duration { font-size: 11px; color: var(--text-3); font-family: var(--font-mono); margin-left: 4px; }

.ep-arrow { color: var(--text-3); flex-shrink: 0; transition: transform 0.18s; }
.ep-card:hover .ep-arrow { transform: translateX(3px); color: var(--accent); }

/* Project assets */
.project-assets {
  display: flex;
  flex-direction: column;
  gap: 22px;
  max-width: 980px;
  margin-top: 28px;
}
.asset-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.section-label.compact {
  margin-bottom: 0;
}
.asset-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--accent-bg);
  color: var(--accent-text);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0;
}
.asset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 10px;
}
.asset-card {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  padding: 10px;
}
.asset-thumb {
  width: 52px;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: 14px;
  background: var(--bg-2);
  border: 1px solid var(--border);
}
.asset-thumb.scene {
  aspect-ratio: 16 / 10;
}
.asset-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.asset-empty {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-3);
  font-size: 11px;
  font-weight: 700;
}
.asset-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.asset-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-0);
}
.asset-meta {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  color: var(--text-3);
}
.asset-upload-btn {
  grid-column: 1 / -1;
  width: 100%;
}

/* Empty */
.ep-empty {
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  padding: 48px; text-align: center; color: var(--text-3); font-size: 13px;
  border-style: dashed;
}
.ep-empty-icon {
  width: 48px; height: 48px; border-radius: 50%;
  background: var(--bg-2); display: flex; align-items: center; justify-content: center;
}

.dialog-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 38, 0.18);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.dialog {
  width: min(760px, 100%);
  max-height: min(860px, calc(100vh - 48px));
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 26px 26px 22px;
  border-radius: 28px;
  background:
    radial-gradient(circle at top left, rgba(122,167,255,0.14), transparent 34%),
    radial-gradient(circle at top right, rgba(76,125,255,0.08), transparent 26%),
    linear-gradient(180deg, rgba(255,255,255,0.98), rgba(242,247,255,0.92));
  overflow: hidden;
  border: 1px solid rgba(27, 41, 64, 0.08);
  box-shadow: 0 22px 52px rgba(32, 48, 77, 0.14), 0 8px 18px rgba(32, 48, 77, 0.08);
}
.dialog-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.dialog-head-copy { display: flex; flex-direction: column; gap: 8px; max-width: 520px; }
.dialog-kicker {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-3);
}
.dialog-title-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.dialog-title { font-size: 28px; font-weight: 800; color: var(--text-0); letter-spacing: -0.03em; }
.dialog-badge {
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(76,125,255,0.1);
  color: var(--accent-text);
  font-size: 12px;
  font-weight: 700;
}
.dialog-sub { font-size: 14px; line-height: 1.7; color: var(--text-2); }
.dialog-summary {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.summary-chip {
  display: inline-flex;
  align-items: center;
  height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(255,255,255,0.78);
  border: 1px solid rgba(27, 41, 64, 0.08);
  font-size: 12px;
  color: var(--text-2);
}
.dialog-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
  padding-right: 4px;
}
.dialog-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 18px;
  border-radius: 22px;
  background: rgba(255,255,255,0.72);
  border: 1px solid rgba(27, 41, 64, 0.08);
}
.dialog-section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}
.dialog-section-title { font-size: 14px; font-weight: 700; color: var(--text-0); }
.dialog-section-copy { font-size: 12px; color: var(--text-3); }
.config-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.config-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(244,248,255,0.96), rgba(255,255,255,0.78));
  border: 1px solid rgba(27, 41, 64, 0.08);
}
.config-card-kicker {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-3);
}
.dialog-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-top: 2px;
}
.dialog-foot-copy {
  flex: 1;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-3);
}
.field { display: flex; flex-direction: column; gap: 6px; }
.field-label { font-size: 12px; font-weight: 600; color: var(--text-1); }
.field-hint { font-size: 12px; color: var(--text-3); }

@media (max-width: 860px) {
  .dialog {
    width: 100%;
    max-height: calc(100vh - 24px);
    padding: 18px;
    border-radius: 22px;
  }

  .dialog-title {
    font-size: 24px;
  }

  .config-grid {
    grid-template-columns: 1fr;
  }

  .dialog-foot {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
