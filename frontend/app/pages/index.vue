<template>
  <div class="home-page">
    <section class="home-head">
      <span class="home-kicker">HANFOR AI</span>
      <h1>首页</h1>
      <p>选择一个入口开始创作：做短剧、生成图片，或者先试一段语音。</p>
    </section>

    <section class="home-actions">
      <button type="button" class="card home-card primary-card" @click="showCreate = true">
        <span class="home-icon">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
            <rect x="3" y="3" width="18" height="18" rx="3"/>
            <line x1="12" y1="8" x2="12" y2="16"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
        </span>
        <strong>新建一个短剧</strong>
        <small>从剧本到成片，进入短剧制作工作台</small>
      </button>

      <button type="button" class="card home-card" @click="navigateTo('/image-projects')">
        <span class="home-icon">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="3"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <path d="M21 15l-5-5L5 21"/>
          </svg>
        </span>
        <strong>先生成一张图片</strong>
        <small>做角色图、场景图、海报或分镜参考图</small>
      </button>

      <button type="button" class="card home-card" @click="navigateTo('/voice-projects')">
        <span class="home-icon">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 3v18"/>
            <path d="M8 7v10"/>
            <path d="M16 7v10"/>
            <path d="M4 11v2"/>
            <path d="M20 11v2"/>
          </svg>
        </span>
        <strong>先生成一段语音</strong>
        <small>试旁白、对白，或验证音色效果</small>
      </button>
    </section>

    <section class="home-shortcuts card">
      <div>
        <h2>继续已有内容</h2>
        <p>如果已经创建过项目，可以直接进入对应工作区。</p>
      </div>
      <div class="shortcut-actions">
        <button type="button" class="btn" @click="navigateTo('/drama-projects')">短剧项目</button>
        <button type="button" class="btn" @click="navigateTo('/assets')">资产库</button>
        <button type="button" class="btn" @click="navigateTo('/settings')">AI 设置</button>
      </div>
    </section>

    <div v-if="showCreate" class="overlay" @click.self="showCreate = false">
      <div class="modal card">
        <div class="modal-header">
          <div class="modal-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
              <rect x="3" y="3" width="18" height="18" rx="3"/>
              <line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
          </div>
          <h2 class="modal-title">新建短剧项目</h2>
          <p class="modal-desc">输入项目基本信息，即可开始制作</p>
        </div>
        <form class="modal-form" @submit.prevent="create">
          <label class="field">
            <span class="field-label">项目名称 <span class="required">*</span></span>
            <input v-model="form.title" class="input" placeholder="例如：都市情感短剧《时光邮局》" required autofocus />
          </label>
          <div class="field-row">
            <label class="field">
              <span class="field-label">计划集数</span>
              <input v-model.number="form.total_episodes" class="input" type="number" min="1" max="100" />
            </label>
            <label class="field">
              <span class="field-label">视觉风格</span>
              <BaseSelect v-model="form.style" :options="styleSelectOptions" placeholder="选择风格" searchable />
            </label>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn" @click="showCreate = false">取消</button>
            <button type="submit" class="btn btn-primary">创建项目</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { toast } from 'vue-sonner'
import { dramaAPI } from '~/composables/useApi'
import BaseSelect from '~/components/BaseSelect.vue'
import { visualStyleOptions } from '~/utils/visualStyles'

const showCreate = ref(false)
const form = ref({ title: '', total_episodes: 1, style: '' })
const styleSelectOptions = computed(() => visualStyleOptions)

useHead({ title: '首页 - 涵锋Ai' })

async function create() {
  if (!form.value.title?.trim()) return
  try {
    const drama = await dramaAPI.create(form.value)
    showCreate.value = false
    navigateTo(`/drama/${drama.id}`)
  } catch (error) {
    toast.error(error.message)
  }
}
</script>

<style scoped>
.home-page {
  flex: 1;
  overflow: auto;
  padding: 42px 48px;
  animation: fadeUp 0.35s var(--ease-out) both;
}
.home-head {
  max-width: 720px;
  margin-bottom: 26px;
}
.home-kicker {
  display: block;
  margin-bottom: 8px;
  color: var(--accent-text);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.16em;
}
.home-head h1 {
  font-size: 34px;
}
.home-head p {
  margin-top: 8px;
  color: var(--text-2);
  font-size: 14px;
}
.home-actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
}
.home-card {
  min-height: 210px;
  padding: 32px 26px;
  border-style: dashed;
  border-width: 1.5px;
  background: var(--bg-surface);
  color: inherit;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  text-align: center;
  font-family: var(--font-body);
}
.home-card:hover {
  border-color: var(--accent);
  background: var(--accent-bg);
  transform: translateY(-2px);
}
.primary-card {
  border-color: rgba(76,125,255,0.28);
  background: linear-gradient(180deg, var(--bg-surface), var(--bg-1));
}
.home-icon {
  width: 58px;
  height: 58px;
  border-radius: var(--radius-lg);
  background: var(--bg-2);
  color: var(--text-3);
  display: flex;
  align-items: center;
  justify-content: center;
}
.home-card:hover .home-icon {
  background: var(--accent-bg);
  color: var(--accent);
}
.home-card strong {
  color: var(--text-0);
  font-size: 16px;
}
.home-card small {
  max-width: 260px;
  color: var(--text-3);
  font-size: 12px;
  line-height: 1.7;
}
.home-shortcuts {
  margin-top: 18px;
  padding: 18px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.home-shortcuts h2 {
  font-size: 17px;
}
.home-shortcuts p {
  margin-top: 4px;
  color: var(--text-2);
  font-size: 12px;
}
.shortcut-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.modal { padding: 32px; width: 460px; box-shadow: var(--shadow-elevated); animation: scaleIn 0.2s var(--ease-out); }
.modal-header { margin-bottom: 24px; display: flex; flex-direction: column; gap: 6px; }
.modal-icon {
  width: 44px; height: 44px; border-radius: var(--radius);
  background: var(--accent-bg); color: var(--accent);
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 4px;
}
.modal-title { font-family: var(--font-display); font-size: 19px; font-weight: 700; }
.modal-desc { font-size: 13px; color: var(--text-3); }
.modal-form { display: flex; flex-direction: column; gap: 16px; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field-label { font-size: 12px; font-weight: 600; color: var(--text-1); }
.required { color: var(--error); }
.field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; padding-top: 6px; }
@media (max-width: 900px) {
  .home-page { padding: 28px 24px; }
  .home-shortcuts { align-items: flex-start; flex-direction: column; }
  .shortcut-actions { justify-content: flex-start; }
  .field-row { grid-template-columns: 1fr; }
}
</style>
