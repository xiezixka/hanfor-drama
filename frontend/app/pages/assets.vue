<template>
  <div class="assets-page">
    <header class="assets-head">
      <div>
        <h1 class="page-title">资产</h1>
        <p class="page-subtitle">集中查看已经生成好的图片、声音和视频。</p>
      </div>
      <button class="btn btn-ghost" :disabled="loading" @click="loadAssets">
        {{ loading ? '刷新中...' : '刷新' }}
      </button>
    </header>

    <div class="asset-toolbar">
      <input
        v-model="search"
        class="asset-search"
        placeholder="搜索标题、项目、集数、提示词或来源"
      />
      <select v-model="sortKey" class="asset-select" aria-label="资产排序">
        <option value="newest">最新优先</option>
        <option value="oldest">最早优先</option>
        <option value="name">名称排序</option>
        <option value="type">类型排序</option>
      </select>
      <select v-model.number="pageSize" class="asset-select page-size" aria-label="每页数量">
        <option :value="12">每页 12 个</option>
        <option :value="24">每页 24 个</option>
        <option :value="48">每页 48 个</option>
      </select>
      <span class="search-count">{{ totalResults }} 个结果</span>
    </div>

    <div class="summary-row">
      <button
        v-for="item in filters"
        :key="item.value"
        :class="['summary-chip', { active: activeType === item.value }]"
        @click="activeType = item.value"
      >
        <span>{{ item.label }}</span>
        <strong>{{ countFor(item.value) }}</strong>
      </button>
    </div>

    <div v-if="assets.length" class="bulk-bar">
      <label class="select-page">
        <input
          type="checkbox"
          :checked="isPageSelected"
          :indeterminate.prop="isPagePartiallySelected"
          @change="togglePageSelection"
        />
        <span>选择本页</span>
      </label>
      <span v-if="selectedIds.size" class="selected-count">已选择 {{ selectedIds.size }} 个</span>
      <button v-if="selectedIds.size" class="btn btn-danger btn-sm" :disabled="bulkDeleting" @click="confirmBulkDelete">
        {{ bulkDeleting ? '删除中' : '批量删除' }}
      </button>
      <button v-if="selectedIds.size" class="btn btn-ghost btn-sm" @click="clearSelection">取消选择</button>
    </div>

    <section v-if="!assets.length && !loading" class="empty-state">
      <div class="empty-icon">▣</div>
      <h2>还没有可用资产</h2>
      <p>生成图片、语音或视频后，会自动出现在这里。</p>
    </section>

    <div v-else class="asset-grid">
      <article v-for="asset in assets" :key="asset.id" class="asset-card">
        <label class="asset-check" :aria-label="`选择 ${asset.title}`">
          <input type="checkbox" :checked="selectedIds.has(asset.id)" @change="toggleAsset(asset.id)" />
        </label>
        <button v-if="asset.type !== 'audio'" class="asset-preview preview-button" :class="asset.type" @click="openPreview(asset)">
          <img v-if="asset.type === 'image'" :src="asset.url" :alt="asset.title" loading="lazy" />
          <video v-else :src="asset.url" muted preload="metadata" />
          <span class="preview-hint">预览</span>
        </button>
        <div v-else class="asset-preview audio">
          <div class="audio-tile">
            <span class="audio-mark">♪</span>
            <div class="audio-copy">
              <strong>{{ asset.title }}</strong>
              <span>{{ provenance(asset) || asset.source }}</span>
            </div>
            <div class="audio-player">
              <button class="audio-play" type="button" @click="toggleAudio(asset)">
                {{ activeAudioId === asset.id && audioPlaying ? '暂停' : '播放' }}
              </button>
              <input
                class="audio-range"
                type="range"
                min="0"
                :max="audioDuration(asset.id)"
                step="0.1"
                :value="audioProgress(asset.id)"
                @input="seekAudio(asset, $event.target.value)"
              />
              <span class="audio-time">{{ audioTime(asset.id) }}</span>
            </div>
          </div>
        </div>
        <div class="asset-body">
          <div class="asset-line">
            <h3>{{ asset.title }}</h3>
            <span class="tag" :class="typeClass(asset.type)">
              {{ typeLabel(asset.type) }}
            </span>
          </div>
          <p v-if="asset.prompt" class="asset-desc">{{ asset.prompt }}</p>
          <div class="asset-meta">
            <span v-if="asset.drama_title" class="asset-source">{{ provenance(asset) }}</span>
            <span>{{ asset.source }}</span>
            <span v-if="asset.model">{{ asset.model }}</span>
            <span>{{ formatDate(asset.created_at) }}</span>
          </div>
          <div class="asset-actions">
            <a class="btn btn-ghost btn-sm" :href="asset.url" target="_blank" rel="noopener">打开</a>
            <a class="btn btn-primary btn-sm" :href="asset.url" download>下载</a>
            <button class="btn btn-danger btn-sm" :disabled="deletingId === asset.id" @click="confirmDelete(asset)">
              {{ deletingId === asset.id ? '删除中' : '删除' }}
            </button>
          </div>
        </div>
      </article>
    </div>

    <footer v-if="totalPages > 1" class="pager">
      <button class="btn btn-ghost btn-sm" :disabled="page === 1" @click="page--">上一页</button>
      <span>第 {{ page }} / {{ totalPages }} 页</span>
      <button class="btn btn-ghost btn-sm" :disabled="page === totalPages" @click="page++">下一页</button>
    </footer>

    <div v-if="previewAsset" class="overlay" @click.self="closePreview">
      <section class="lightbox card">
        <header class="lightbox-head">
          <div>
            <h2>{{ previewAsset.title }}</h2>
            <p>{{ provenance(previewAsset) || previewAsset.source }}</p>
          </div>
          <button class="btn btn-ghost btn-sm" @click="closePreview">关闭</button>
        </header>
        <img v-if="previewAsset.type === 'image'" :src="previewAsset.url" :alt="previewAsset.title" />
        <video v-else :src="previewAsset.url" controls autoplay />
      </section>
    </div>

    <div v-if="deleteTarget" class="overlay" @click.self="deleteTarget = null">
      <section class="confirm-card card">
        <h2>{{ deleteTarget.bulk ? '批量删除资产' : '删除资产' }}</h2>
        <p>
          {{ deleteTarget.bulk ? `确定删除选中的 ${selectedIds.size} 个资产吗？` : `确定删除「${deleteTarget.asset.title}」吗？` }}
          删除后会从资产库中移除。
        </p>
        <div class="confirm-actions">
          <button class="btn btn-ghost" @click="deleteTarget = null">取消</button>
          <button class="btn btn-danger" :disabled="deletingId || bulkDeleting" @click="runDelete">
            {{ deletingId || bulkDeleting ? '删除中' : '确认删除' }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { toast } from 'vue-sonner'
import { assetsAPI } from '~/composables/useApi'

const loading = ref(false)
const deletingId = ref('')
const bulkDeleting = ref(false)
const activeType = ref('all')
const search = ref('')
const sortKey = ref('newest')
const page = ref(1)
const pageSize = ref(12)
const totalResults = ref(0)
const totalPages = ref(1)
const previewAsset = ref(null)
const deleteTarget = ref(null)
const selectedIds = ref(new Set())
const assets = ref([])
const counts = ref({ all: 0, image: 0, audio: 0, video: 0 })
const activeAudioId = ref('')
const audioPlaying = ref(false)
const audioCurrent = ref(0)
const audioTotal = ref(0)
const audioEl = ref(null)
const filters = [
  { label: '全部资产', value: 'all' },
  { label: '图片', value: 'image' },
  { label: '声音', value: 'audio' },
  { label: '视频', value: 'video' },
]

const visibleIds = computed(() => assets.value.map(item => item.id))
const isPageSelected = computed(() => visibleIds.value.length > 0 && visibleIds.value.every(id => selectedIds.value.has(id)))
const isPagePartiallySelected = computed(() => visibleIds.value.some(id => selectedIds.value.has(id)) && !isPageSelected.value)
let searchTimer = null

watch([activeType, search, sortKey, pageSize], () => {
  page.value = 1
  scheduleLoad()
})

watch(page, () => {
  scheduleLoad()
})

useHead({ title: '资产 - 涵锋Ai' })

function countFor(type) {
  return counts.value[type] ?? assets.value.length
}

function typeLabel(type) {
  return type === 'image' ? '图片' : type === 'video' ? '视频' : '声音'
}

function typeClass(type) {
  if (type === 'image') return 'tag-info'
  if (type === 'video') return 'tag-accent'
  return 'tag-success'
}

function formatDate(value) {
  if (!value) return '未知时间'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '未知时间'
  return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function provenance(asset) {
  const parts = [asset.drama_title]
  if (asset.episode_number) parts.push(`第 ${asset.episode_number} 集`)
  else if (asset.episode_title) parts.push(asset.episode_title)
  return parts.filter(Boolean).join(' · ')
}

function openPreview(asset) {
  previewAsset.value = asset
}

function closePreview() {
  previewAsset.value = null
}

function toggleAsset(id) {
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
}

function togglePageSelection() {
  const next = new Set(selectedIds.value)
  if (isPageSelected.value) visibleIds.value.forEach(id => next.delete(id))
  else visibleIds.value.forEach(id => next.add(id))
  selectedIds.value = next
}

function clearSelection() {
  selectedIds.value = new Set()
}

function confirmDelete(asset) {
  deleteTarget.value = { asset, bulk: false }
}

function confirmBulkDelete() {
  deleteTarget.value = { bulk: true }
}

async function loadAssets() {
  loading.value = true
  try {
    const res = await assetsAPI.list({
      type: activeType.value === 'all' ? undefined : activeType.value,
      search: search.value.trim() || undefined,
      sort: sortKey.value,
      page: page.value,
      limit: pageSize.value,
    })
    assets.value = res.items || []
    totalResults.value = res.pagination?.total ?? assets.value.length
    totalPages.value = res.pagination?.total_pages ?? 1
    if (res.pagination?.page && res.pagination.page !== page.value) page.value = res.pagination.page
    counts.value = res.counts || {
      all: assets.value.length,
      image: assets.value.filter(item => item.type === 'image').length,
      audio: assets.value.filter(item => item.type === 'audio').length,
      video: assets.value.filter(item => item.type === 'video').length,
    }
  } catch (err) {
    toast.error(err.message)
  } finally {
    loading.value = false
  }
}

function scheduleLoad() {
  if (searchTimer) window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => {
    loadAssets()
  }, 220)
}

async function runDelete() {
  if (!deleteTarget.value) return
  if (deleteTarget.value.bulk) {
    await deleteSelectedAssets()
  } else {
    await deleteAsset(deleteTarget.value.asset)
  }
  deleteTarget.value = null
}

async function deleteAsset(asset) {
  deletingId.value = asset.id
  try {
    await assetsAPI.del(asset.id)
    removeAssets([asset])
    toast.success('资产已删除')
  } catch (err) {
    toast.error(err.message)
  } finally {
    deletingId.value = ''
  }
}

async function deleteSelectedAssets() {
  const targets = assets.value.filter(item => selectedIds.value.has(item.id))
  if (!targets.length) return
  bulkDeleting.value = true
  try {
    for (const asset of targets) {
      await assetsAPI.del(asset.id)
    }
    removeAssets(targets)
    clearSelection()
    toast.success(`已删除 ${targets.length} 个资产`)
  } catch (err) {
    toast.error(err.message)
  } finally {
    bulkDeleting.value = false
  }
}

function removeAssets(items) {
  const removeIds = new Set(items.map(item => item.id))
  assets.value = assets.value.filter(item => !removeIds.has(item.id))
  counts.value = {
    all: Math.max(0, (counts.value.all || 0) - items.length),
    image: Math.max(0, (counts.value.image || 0) - items.filter(item => item.type === 'image').length),
    audio: Math.max(0, (counts.value.audio || 0) - items.filter(item => item.type === 'audio').length),
    video: Math.max(0, (counts.value.video || 0) - items.filter(item => item.type === 'video').length),
  }
  selectedIds.value = new Set([...selectedIds.value].filter(id => !removeIds.has(id)))
  totalResults.value = Math.max(0, totalResults.value - items.length)
  totalPages.value = Math.max(1, Math.ceil(totalResults.value / pageSize.value))
  if (page.value > totalPages.value) page.value = totalPages.value
}

function toggleAudio(asset) {
  if (!audioEl.value) setupAudio()
  if (activeAudioId.value === asset.id && audioPlaying.value) {
    audioEl.value.pause()
    return
  }
  if (activeAudioId.value !== asset.id) {
    activeAudioId.value = asset.id
    audioCurrent.value = 0
    audioTotal.value = 0
    audioEl.value.src = asset.url
  }
  audioEl.value.play().catch(err => toast.error(err.message || '播放失败'))
}

function seekAudio(asset, value) {
  if (!audioEl.value) setupAudio()
  if (activeAudioId.value !== asset.id) {
    activeAudioId.value = asset.id
    audioEl.value.src = asset.url
  }
  audioEl.value.currentTime = Number(value || 0)
}

function setupAudio() {
  if (!process.client || audioEl.value) return
  audioEl.value = new Audio()
  audioEl.value.addEventListener('play', () => { audioPlaying.value = true })
  audioEl.value.addEventListener('pause', () => { audioPlaying.value = false })
  audioEl.value.addEventListener('ended', () => { audioPlaying.value = false })
  audioEl.value.addEventListener('timeupdate', () => { audioCurrent.value = audioEl.value?.currentTime || 0 })
  audioEl.value.addEventListener('loadedmetadata', () => { audioTotal.value = audioEl.value?.duration || 0 })
}

function audioDuration(id) {
  return activeAudioId.value === id && audioTotal.value ? audioTotal.value : 1
}

function audioProgress(id) {
  return activeAudioId.value === id ? audioCurrent.value : 0
}

function audioTime(id) {
  if (activeAudioId.value !== id) return '00:00'
  return `${formatSeconds(audioCurrent.value)} / ${formatSeconds(audioTotal.value)}`
}

function formatSeconds(value) {
  const seconds = Math.max(0, Math.floor(Number(value) || 0))
  const minute = Math.floor(seconds / 60)
  const second = seconds % 60
  return `${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`
}

onMounted(() => {
  setupAudio()
  loadAssets()
})

onBeforeUnmount(() => {
  if (searchTimer) window.clearTimeout(searchTimer)
  if (audioEl.value) {
    audioEl.value.pause()
    audioEl.value.src = ''
  }
})
</script>

<style scoped>
.assets-page {
  flex: 1;
  overflow: auto;
  padding: 32px 48px;
}
.assets-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 22px;
}
.asset-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}
.asset-search {
  width: min(520px, 100%);
  height: 42px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-1);
  color: var(--text-0);
  padding: 0 14px;
  font-size: 14px;
  outline: none;
}
.asset-search:focus {
  border-color: rgba(69, 112, 232, 0.45);
  box-shadow: 0 0 0 3px rgba(69, 112, 232, 0.1);
}
.asset-select {
  height: 42px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-1);
  color: var(--text-0);
  padding: 0 12px;
  font-size: 13px;
  outline: none;
}
.asset-select:focus {
  border-color: rgba(69, 112, 232, 0.45);
  box-shadow: 0 0 0 3px rgba(69, 112, 232, 0.1);
}
.page-size {
  min-width: 112px;
}
.search-count {
  color: var(--text-3);
  font-size: 12px;
  white-space: nowrap;
}
.page-title {
  font-size: 30px;
}
.page-subtitle {
  color: var(--text-2);
  margin-top: 4px;
}
.summary-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 22px;
}
.summary-chip {
  min-width: 128px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-1);
  color: var(--text-2);
  padding: 12px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  cursor: pointer;
}
.summary-chip strong {
  font-size: 18px;
  color: var(--text-0);
}
.summary-chip.active {
  border-color: rgba(69, 112, 232, 0.4);
  background: var(--accent-bg);
  color: var(--accent-text);
}
.bulk-bar {
  min-height: 38px;
  margin: -8px 0 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  color: var(--text-2);
  font-size: 13px;
}
.select-page {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}
.select-page input,
.asset-check input {
  width: 16px;
  height: 16px;
  accent-color: #4570e8;
}
.selected-count {
  color: var(--accent-text);
  font-weight: 700;
}
.asset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
  align-items: start;
}
.asset-card {
  position: relative;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-1);
  overflow: hidden;
  box-shadow: var(--shadow);
  transition: transform 0.16s var(--ease-out), box-shadow 0.16s var(--ease-out);
}
.asset-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-elevated);
}
.asset-check {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 2;
  width: 28px;
  height: 28px;
  border-radius: 10px;
  background: var(--bg-surface);
  border: 1px solid rgba(169, 184, 210, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 18px rgba(30, 45, 76, 0.12);
}
.asset-preview {
  aspect-ratio: 16 / 10;
  background: var(--bg-2);
  display: flex;
  align-items: center;
  justify-content: center;
}
.preview-button {
  position: relative;
  width: 100%;
  border: none;
  padding: 0;
  cursor: zoom-in;
  overflow: hidden;
}
.asset-preview img,
.asset-preview video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.preview-hint {
  position: absolute;
  right: 10px;
  bottom: 10px;
  border-radius: 999px;
  background: rgba(20, 32, 54, 0.72);
  color: white;
  padding: 5px 10px;
  font-size: 12px;
  opacity: 0;
  transform: translateY(4px);
  transition: opacity 0.16s var(--ease-out), transform 0.16s var(--ease-out);
}
.preview-button:hover .preview-hint {
  opacity: 1;
  transform: translateY(0);
}
.audio-tile {
  width: 100%;
  height: 100%;
  padding: 22px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background:
    linear-gradient(135deg, rgba(69, 112, 232, 0.09), rgba(38, 186, 142, 0.08)),
    var(--bg-2);
}
.audio-mark {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  background: var(--accent-bg);
  color: var(--accent-text);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 700;
}
.audio-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: center;
  max-width: 100%;
}
.audio-copy strong {
  color: var(--text-0);
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.audio-copy span {
  color: var(--text-3);
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.audio-player {
  width: 100%;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  border: 1px solid rgba(169, 184, 210, 0.45);
  border-radius: var(--radius);
  background: var(--bg-surface);
  padding: 8px;
}
.audio-play {
  height: 30px;
  min-width: 48px;
  border: none;
  border-radius: 8px;
  background: #4570e8;
  color: white;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}
.audio-range {
  width: 100%;
  accent-color: #4570e8;
}
.audio-time {
  color: var(--text-3);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.asset-body {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.asset-line {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}
.asset-line h3 {
  font-size: 14px;
  line-height: 1.35;
}
.asset-desc {
  color: var(--text-2);
  font-size: 12px;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.asset-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  color: var(--text-3);
  font-size: 11px;
}
.asset-source {
  color: var(--accent-text);
  font-weight: 700;
}
.asset-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}
.btn-danger {
  border-color: rgba(201, 88, 68, 0.28);
  background: rgba(201, 88, 68, 0.08);
  color: #a13e2b;
}
.btn-danger:hover {
  border-color: rgba(201, 88, 68, 0.42);
  background: rgba(201, 88, 68, 0.14);
}
.empty-state {
  min-height: 320px;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius);
  background: var(--bg-1);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: var(--text-2);
}
.empty-state h2 {
  color: var(--text-0);
  font-size: 18px;
  margin-top: 14px;
}
.empty-state p {
  margin-top: 6px;
}
.empty-icon {
  width: 54px;
  height: 54px;
  border-radius: 18px;
  background: var(--accent-bg);
  color: var(--accent-text);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
}
.pager {
  margin-top: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-2);
  font-size: 13px;
}
.overlay {
  position: fixed;
  inset: 0;
  z-index: 80;
  background: rgba(20, 32, 54, 0.48);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 28px;
}
.lightbox {
  width: min(940px, 100%);
  max-height: min(820px, 92vh);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.lightbox-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.lightbox-head h2 {
  font-size: 18px;
  line-height: 1.35;
}
.lightbox-head p {
  margin-top: 4px;
  color: var(--text-3);
  font-size: 12px;
}
.lightbox img,
.lightbox video {
  max-height: calc(92vh - 120px);
  width: 100%;
  object-fit: contain;
  border-radius: var(--radius);
  background: var(--bg-2);
}
.confirm-card {
  width: min(420px, 100%);
  padding: 24px;
}
.confirm-card h2 {
  font-size: 20px;
}
.confirm-card p {
  margin-top: 10px;
  color: var(--text-2);
  line-height: 1.7;
}
.confirm-actions {
  margin-top: 22px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
@media (max-width: 900px) {
  .assets-page { padding: 24px; }
  .assets-head { align-items: flex-start; flex-direction: column; }
  .asset-search { width: 100%; }
  .asset-select { flex: 1; min-width: 130px; }
  .summary-chip { min-width: 0; flex: 1; }
  .overlay { padding: 16px; }
}
</style>
