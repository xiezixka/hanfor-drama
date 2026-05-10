<template>
  <div class="shell">
    <!-- Header -->
    <header class="header">
      <div class="header-left">
        <button class="brand" @click="navigateTo('/')">
          <div class="brand-mark">
            <img v-if="showBrandImage" :src="brandLogo" alt="涵锋Ai" class="brand-logo" @error="showBrandImage = false" />
            <span v-else class="brand-fallback">火</span>
          </div>
          <div class="brand-text">
            <span class="brand-name">涵锋Ai</span>
            <span class="brand-sub">Hanfor AI</span>
          </div>
        </button>
      </div>

      <nav class="header-nav">
        <NuxtLink to="/" class="nav-link" :class="{ active: route.path === '/' }">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 11.5 12 4l9 7.5"/>
            <path d="M5 10.5V20h14v-9.5"/>
            <path d="M10 20v-5h4v5"/>
          </svg>
          <span>首页</span>
        </NuxtLink>
        <NuxtLink to="/drama-projects" class="nav-link" :class="{ active: isDramaActive }">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
          <span>短剧项目</span>
        </NuxtLink>
        <NuxtLink to="/image-projects" class="nav-link" :class="{ active: route.path === '/image-projects' }">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <path d="M21 15l-5-5L5 21"/>
          </svg>
          <span>图片项目</span>
        </NuxtLink>
        <NuxtLink to="/voice-projects" class="nav-link" :class="{ active: route.path === '/voice-projects' }">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 3v18"/>
            <path d="M8 7v10"/>
            <path d="M16 7v10"/>
            <path d="M4 11v2"/>
            <path d="M20 11v2"/>
          </svg>
          <span>语音项目</span>
        </NuxtLink>
        <NuxtLink to="/assets" class="nav-link" :class="{ active: route.path === '/assets' }">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H10l2 2h5.5A2.5 2.5 0 0 1 20 9.5v7A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z"/>
            <path d="M8 13h8"/>
          </svg>
          <span>资产</span>
        </NuxtLink>
        <NuxtLink to="/settings" class="nav-link" :class="{ active: route.path === '/settings' }">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          <span>设置</span>
        </NuxtLink>
      </nav>

      <div class="header-right">
        <div class="theme-switch" role="group" aria-label="全局主题模式">
          <button
            type="button"
            :class="['theme-option', { active: theme === 'light' }]"
            aria-label="全局浅色模式"
            title="全局浅色模式"
            @click="applyTheme('light')"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="4"/>
              <path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>
            </svg>
          </button>
          <button
            type="button"
            :class="['theme-option', { active: theme === 'dark' }]"
            aria-label="全局暗色模式"
            title="全局暗色模式"
            @click="applyTheme('dark')"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20.7 15.2A8.5 8.5 0 0 1 8.8 3.3 7 7 0 1 0 20.7 15.2Z"/>
            </svg>
          </button>
        </div>
      </div>
    </header>

    <main class="content">
      <slot />
    </main>
  </div>
</template>

<script setup>
import brandLogo from '~/assets/huobao-logo.png'

const route = useRoute()
const showBrandImage = ref(true)
const theme = ref('light')
const isDramaActive = computed(() => route.path === '/drama-projects' || route.path.startsWith('/drama/'))

function applyTheme(value) {
  theme.value = value
  document.documentElement.dataset.theme = value
}

onMounted(() => {
  applyTheme('light')
})
</script>

<style scoped>
.shell {
  display: flex; flex-direction: column;
  height: 100vh; overflow: hidden;
  background: var(--bg-base);
}

/* === Header === */
.header {
  display: flex; align-items: center;
  height: 56px; flex-shrink: 0;
  padding: 0 24px;
  background: var(--bg-1);
  border-bottom: 1px solid var(--border);
  gap: 32px;
}

.header-left { display: flex; align-items: center; }

.brand {
  display: flex; align-items: center; gap: 10px;
  background: none; border: none; cursor: pointer; padding: 0;
  text-decoration: none; border-radius: var(--radius);
  transition: opacity 0.15s;
}
.brand:hover { opacity: 0.75; }
.brand-mark {
  width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  background: var(--bg-2); border-radius: var(--radius);
  border: 1px solid var(--border);
  overflow: hidden;
}
.brand-logo {
  width: 22px;
  height: 22px;
  object-fit: contain;
  display: block;
}
.brand-fallback {
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 700;
  color: var(--accent-text);
  line-height: 1;
}
.brand-text { display: flex; flex-direction: column; align-items: flex-start; line-height: 1; }
.brand-name {
  font-family: var(--font-display);
  font-size: 15px; font-weight: 700;
  color: var(--text-0);
  letter-spacing: -0.01em;
}
.brand-sub {
  font-size: 10px; font-weight: 400;
  color: var(--text-3); margin-top: 1px;
  letter-spacing: 0.04em;
}

/* Nav */
.header-nav { display: flex; gap: 4px; flex: 1; }
.nav-link {
  display: flex; align-items: center; gap: 7px;
  padding: 7px 14px; border-radius: var(--radius);
  font-size: 13px; font-weight: 500;
  color: var(--text-2); text-decoration: none;
  transition: all 0.18s var(--ease-out);
  border: 1px solid transparent;
}
.nav-link:hover {
  background: var(--bg-hover); color: var(--text-0);
  border-color: var(--border);
}
.nav-link.active {
  background: var(--accent-bg);
  color: var(--accent-text);
  border-color: rgba(76,125,255,0.18);
  font-weight: 600;
}

.header-right { display: flex; align-items: center; margin-left: auto; }

.theme-switch {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
.theme-option {
  width: 28px;
  height: 24px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-3);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.18s var(--ease-out), color 0.18s var(--ease-out), box-shadow 0.18s var(--ease-out);
}
.theme-option:hover {
  color: var(--text-0);
  background: var(--bg-hover);
}
.theme-option.active {
  color: var(--accent-text);
  background: var(--bg-0);
  box-shadow: var(--shadow-xs);
}

/* Content */
.content { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
</style>
