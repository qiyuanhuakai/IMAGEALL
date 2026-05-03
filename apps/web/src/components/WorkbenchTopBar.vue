<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import type { LocaleCode, LocaleOption, ProviderManifest, Workspace } from '@imageall/core'

const props = defineProps<{
  locales: LocaleOption[]
  workspaces: Workspace[]
  providers: ProviderManifest[]
  selectedWorkspaceId: string | undefined
  selectedLocale: LocaleCode
  usingFallbackData: boolean
}>()

const emit = defineEmits<{
  'update:selectedWorkspaceId': [value: string]
  'update:selectedLocale': [value: LocaleCode]
  'update:providerKeys': [keys: Record<string, string>]
  'select:workspaceFolder': [path: string]
}>()

const showSettings = ref(false)
const showProviders = ref(false)
const showFolderPicker = ref(false)
const fsPath = ref('')
const fsDirs = ref<Array<{ name: string; path: string }>>([])
const fsLoading = ref(false)
const fsError = ref('')

function isLocaleCode(value: string): value is LocaleCode {
  return value === 'en' || value === 'zh-CN'
}

function handleLocaleChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  if (isLocaleCode(value)) {
    emit('update:selectedLocale', value)
  }
}

function closeAll() {
  showSettings.value = false
  showProviders.value = false
  showFolderPicker.value = false
}

function onDocumentClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.topbar__right')) {
    closeAll()
  }
}

function closeFolderPicker() {
  showFolderPicker.value = false
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
})

onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick)
})

interface ProviderKeyEntry {
  providerId: string
  label: string
  envKey: string
  value: string
}

const providerKeys = ref<ProviderKeyEntry[]>([])

function loadProviderKeys() {
  const saved: Record<string, string> = {}
  try {
    const raw = localStorage.getItem('imageall_provider_keys')
    if (raw) Object.assign(saved, JSON.parse(raw))
  } catch { /* ignore */ }

  providerKeys.value = (props.providers ?? []).map((p) => ({
    providerId: p.id,
    label: p.label,
    envKey: p.auth.envKey,
    value: saved[p.id] ?? '',
  }))
}

function saveProviderKeys() {
  const map: Record<string, string> = {}
  for (const entry of providerKeys.value) {
    if (entry.value.trim()) {
      map[entry.providerId] = entry.value.trim()
    }
  }
  localStorage.setItem('imageall_provider_keys', JSON.stringify(map))
  emit('update:providerKeys', map)
  showProviders.value = false
}

function openProviders() {
  loadProviderKeys()
  showProviders.value = true
  showSettings.value = false
}

async function openFolderPicker() {
  showFolderPicker.value = true
  showSettings.value = false
  fsLoading.value = true
  fsError.value = ''
  try {
    const res = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? ''}/api/fs/list?path=~`)
    const data = await res.json()
    if (data.ok) {
      fsPath.value = data.path
      fsDirs.value = data.directories
    } else {
      fsError.value = data.message
    }
  } catch (e) {
    fsError.value = 'Cannot connect to server'
  } finally {
    fsLoading.value = false
  }
}

async function navigateFolder(path: string) {
  fsLoading.value = true
  fsError.value = ''
  try {
    const res = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? ''}/api/fs/list?path=${encodeURIComponent(path)}`)
    const data = await res.json()
    if (data.ok) {
      fsPath.value = data.path
      fsDirs.value = data.directories
    } else {
      fsError.value = data.message
    }
  } catch (e) {
    fsError.value = 'Cannot connect to server'
  } finally {
    fsLoading.value = false
  }
}

function selectFolder() {
  emit('select:workspaceFolder', fsPath.value)
  showFolderPicker.value = false
  closeAll()
}
</script>

<template>
  <header class="topbar panel glass-panel">
    <div class="topbar__brand">
      <div class="brand-mark" />
      <h1>ImageAll</h1>
    </div>

    <div class="topbar__right">
      <span v-if="usingFallbackData" class="status-chip status-chip--muted">{{ $t('app.usingFallback') }}</span>

      <button class="icon-btn" type="button" :title="$t('topbar.providers')" @click.stop="openProviders">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </button>

      <button class="icon-btn" type="button" :title="$t('topbar.settings')" @click.stop="showSettings = !showSettings; showProviders = false">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
        </svg>
      </button>

      <div v-if="showSettings" class="topbar-dropdown" @click.stop>
        <label class="dropdown-field">
          <span>{{ $t('topbar.locale') }}</span>
          <select
            :value="selectedLocale"
            @change="handleLocaleChange"
          >
            <option v-for="locale in locales" :key="locale.code" :value="locale.code">
              {{ locale.label }}
            </option>
          </select>
        </label>

        <button class="dropdown-folder-btn" type="button" @click="openFolderPicker">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          {{ $t('topbar.selectFolder') }}
        </button>
      </div>

      <div v-if="showFolderPicker" class="topbar-dropdown topbar-dropdown--wide" @click.stop>
        <div class="dropdown-header">
          <p class="dropdown-title">{{ $t('topbar.selectFolder') }}</p>
          <button class="dropdown-close-btn" type="button" @click="closeFolderPicker">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <p class="dropdown-path">{{ fsPath }}</p>
        <div v-if="fsLoading" class="dropdown-loading">{{ $t('app.loading') }}</div>
        <p v-else-if="fsError" class="dropdown-error">{{ fsError }}</p>
        <div v-else class="dropdown-dir-list">
          <button v-if="fsPath !== '/'" class="dir-item dir-item--back" type="button" @click="navigateFolder(fsPath.split('/').slice(0, -1).join('/') || '/')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            ..
          </button>
          <button v-for="dir in fsDirs" :key="dir.path" class="dir-item" type="button" @click="navigateFolder(dir.path)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            {{ dir.name }}
          </button>
        </div>
        <button class="dropdown-save-btn" type="button" @click="selectFolder">{{ $t('topbar.useThisFolder') }}</button>
      </div>

      <div v-if="showProviders" class="topbar-dropdown topbar-dropdown--wide" @click.stop>
        <p class="dropdown-title">{{ $t('topbar.providers') }}</p>
        <label v-for="entry in providerKeys" :key="entry.providerId" class="dropdown-field">
          <span>{{ entry.label }}</span>
          <input
            v-model="entry.value"
            type="password"
            :placeholder="entry.envKey"
            class="dropdown-input"
          />
        </label>
        <button class="dropdown-save-btn" type="button" @click="saveProviderKeys">{{ $t('app.save') }}</button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(237, 243, 255, 0.7);
  cursor: pointer;
  transition: background 0.15s ease;
}

.icon-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #edf3ff;
}

.topbar-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 2000;
  min-width: 180px;
  padding: 0.5rem;
  border: 1px solid rgba(146, 169, 214, 0.2);
  border-radius: 12px;
  background: rgba(8, 14, 24, 0.95);
  backdrop-filter: blur(12px);
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.topbar-dropdown--wide {
  min-width: 260px;
}

.dropdown-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.2rem;
}

.dropdown-title {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 600;
  color: rgba(237, 243, 255, 0.8);
}

.dropdown-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: rgba(237, 243, 255, 0.4);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.dropdown-close-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #edf3ff;
}

.dropdown-field {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.dropdown-field span {
  font-size: 0.68rem;
  color: rgba(237, 243, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.dropdown-field select,
.dropdown-input {
  padding: 0.3rem 0.5rem;
  border-radius: 6px;
  font-size: 0.78rem;
  border: 1px solid rgba(146, 169, 214, 0.2);
  background: rgba(7, 17, 28, 0.8);
  color: #edf3ff;
  width: 100%;
}

.dropdown-save-btn {
  margin-top: 0.2rem;
  padding: 0.35rem;
  border: none;
  border-radius: 8px;
  background: color-mix(in srgb, var(--provider-accent) 30%, rgba(255, 255, 255, 0.1));
  color: #edf3ff;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease;
}

.dropdown-save-btn:hover {
  background: color-mix(in srgb, var(--provider-accent) 50%, rgba(255, 255, 255, 0.15));
}

.dropdown-folder-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.5rem;
  border: 1px solid rgba(146, 169, 214, 0.15);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.04);
  color: rgba(237, 243, 255, 0.7);
  font-size: 0.75rem;
  cursor: pointer;
  width: 100%;
  transition: background 0.15s ease;
}

.dropdown-folder-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #edf3ff;
}

.dropdown-path {
  margin: 0 0 0.3rem;
  font-size: 0.68rem;
  color: rgba(237, 243, 255, 0.4);
  word-break: break-all;
}

.dropdown-loading,
.dropdown-error {
  padding: 0.5rem;
  text-align: center;
  font-size: 0.72rem;
}

.dropdown-error {
  color: #ff9db2;
}

.dropdown-dir-list {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid rgba(146, 169, 214, 0.1);
  border-radius: 6px;
  margin-bottom: 0.3rem;
}

.dir-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
  padding: 0.3rem 0.5rem;
  border: none;
  background: transparent;
  color: rgba(237, 243, 255, 0.7);
  font-size: 0.72rem;
  cursor: pointer;
  text-align: left;
  transition: background 0.1s ease;
}

.dir-item:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #edf3ff;
}

.dir-item--back {
  color: rgba(237, 243, 255, 0.5);
  border-bottom: 1px solid rgba(146, 169, 214, 0.08);
}
</style>
