<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { LocaleCode, LocaleOption, ProviderManifest, Workspace } from '@imageall/core'
import { saveProviderKeys, loadProviderKeys, isSecureStorageAvailable } from '../lib/secureStorage'
import { registerKey, removeKey, listVaultKeys, type KeyListItem } from '../lib/keyVaultClient'

export interface SystemMessage {
  id: string
  level: 'info' | 'warning' | 'error' | 'success'
  text: string
  timestamp: string
  source?: string
}

type SystemMessageLevel = SystemMessage['level']

const props = defineProps<{
  locales: LocaleOption[]
  workspaces: Workspace[]
  providers: ProviderManifest[]
  selectedWorkspaceId: string | undefined
  selectedLocale: LocaleCode
  usingFallbackData: boolean
  isRestoringWorkspace?: boolean
  workspacePath: string | undefined
  systemMessages?: SystemMessage[]
  latestSystemMessage?: SystemMessage | null
}>()

const { t } = useI18n()

const emit = defineEmits<{
  'update:selectedWorkspaceId': [value: string]
  'update:selectedLocale': [value: LocaleCode]
  'update:providerKeys': [keys: Record<string, string>]
  'select:workspaceFolder': [path: string]
  'dismiss:systemMessage': [id: string]
  'clear:systemMessages': []
}>()

const showSettings = ref(false)
const showProviders = ref(false)
const showFolderPicker = ref(false)
const fsPath = ref('')
const fsDirs = ref<Array<{ name: string; path: string }>>([])
const fsLoading = ref(false)
const fsError = ref('')

const vaultKeys = ref<KeyListItem[]>([])
const vaultLoading = ref(false)
const storageEncrypted = ref(isSecureStorageAvailable())

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

async function loadProviderKeysFromStorage() {
  const saved: Record<string, string> = {}
  try {
    const keys = await loadProviderKeys()
    Object.assign(saved, keys)
  } catch { /* ignore */ }

  providerKeys.value = (props.providers ?? []).map((p) => ({
    providerId: p.id,
    label: p.label,
    envKey: p.auth.envKey,
    value: saved[p.id] ?? '',
  }))
}

async function saveProviderKeysToStorage() {
  const map: Record<string, string> = {}
  for (const entry of providerKeys.value) {
    if (entry.value.trim()) {
      map[entry.providerId] = entry.value.trim()
    }
  }

  try {
    await saveProviderKeys(map)
  } catch (err) {
    console.warn('[TopBar] Failed to save encrypted keys:', err)
  }

  emit('update:providerKeys', map)
  showProviders.value = false
}

function openProviders() {
  loadProviderKeysFromStorage()
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

async function registerToVault(providerId: string, apiKey: string) {
  vaultLoading.value = true
  try {
    const result = await registerKey(providerId, apiKey)
    if (result.ok) {
      vaultKeys.value = await listVaultKeys()
    }
  } catch (err) {
    console.warn('[TopBar] Failed to register key to vault:', err)
  } finally {
    vaultLoading.value = false
  }
}

function formatVaultTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

async function removeFromVault(keyRef: string) {
  vaultLoading.value = true
  try {
    await removeKey(keyRef)
    vaultKeys.value = await listVaultKeys()
  } catch (err) {
    console.warn('[TopBar] Failed to remove vault key:', err)
  } finally {
    vaultLoading.value = false
  }
}
</script>

<template>
  <header class="topbar panel glass-panel">
    <div class="topbar__brand">
      <div class="brand-mark" />
      <h1>ImageAll</h1>
    </div>

    <!-- System Messages Bar -->
    <div v-if="latestSystemMessage" class="topbar__system-message" :class="`topbar__system-message--${latestSystemMessage.level}`">
      <span class="topbar__system-message-icon">
        <svg v-if="latestSystemMessage.level === 'error'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        <svg v-else-if="latestSystemMessage.level === 'warning'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <svg v-else-if="latestSystemMessage.level === 'success'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
      </span>
      <span class="topbar__system-message-text">{{ latestSystemMessage.text }}</span>
      <button class="topbar__system-message-close" type="button" :title="$t('app.dismiss')" @click="emit('dismiss:systemMessage', latestSystemMessage.id)">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
    </div>

     <div class="topbar__right">
       <span v-if="usingFallbackData" class="status-chip status-chip--muted">{{ $t('app.usingFallback') }}</span>

       <!-- Workspace path display -->
       <span v-if="workspacePath" class="topbar__path" :title="workspacePath">
         📁 {{ workspacePath.split('/').pop() }}
       </span>

        <!-- Restoration status (loading only; success/error shown in system message bar) -->
        <span v-if="isRestoringWorkspace" class="status-chip status-chip--loading">
          {{ $t('workspace.restoring') }}
        </span>

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
        <div v-if="storageEncrypted" class="dropdown-notice">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          {{ $t('topbar.encryptedStorage') }}
        </div>
        <label v-for="entry in providerKeys" :key="entry.providerId" class="dropdown-field">
          <span>{{ entry.label }}</span>
          <div class="dropdown-field-row">
            <input
              v-model="entry.value"
              type="password"
              :placeholder="entry.envKey"
              class="dropdown-input"
            />
            <button
              v-if="entry.value.trim()"
              class="dropdown-vault-btn"
              type="button"
              :title="$t('topbar.vaultRegister')"
              @click="registerToVault(entry.providerId, entry.value.trim())"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
            </button>
          </div>
        </label>
        <button class="dropdown-save-btn" type="button" @click="saveProviderKeysToStorage">{{ $t('app.save') }}</button>

        <div class="dropdown-divider"></div>

        <p class="dropdown-title dropdown-title--sub">{{ $t('topbar.vault') }}</p>
        <p class="dropdown-hint">{{ $t('topbar.vaultDesc') }}</p>
        <div v-if="vaultLoading" class="dropdown-loading">{{ $t('app.loading') }}</div>
        <div v-else-if="vaultKeys.length === 0" class="dropdown-hint">{{ $t('topbar.vaultEmpty') }}</div>
        <div v-else class="vault-key-list">
          <div v-for="vk in vaultKeys" :key="vk.keyRef" class="vault-key-item">
            <div class="vault-key-info">
              <span class="vault-key-provider">{{ vk.providerId }}</span>
              <span class="vault-key-ref">{{ vk.keyRef }}</span>
              <span v-if="vk.lastUsedAt" class="vault-key-time">{{ formatVaultTime(vk.lastUsedAt) }}</span>
            </div>
            <button class="vault-key-remove" type="button" :title="$t('topbar.vaultRemove')" @click="removeFromVault(vk.keyRef)">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: auto;
  height: auto;
  padding: 0;
  border: none;
  border-radius: 0;
  background: transparent;
  color: rgba(237, 243, 255, 0.55);
  cursor: pointer;
  transition: color 0.15s ease;
}

.icon-btn:hover {
  background: transparent;
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

.dropdown-field-row {
  display: flex;
  gap: 0.3rem;
  align-items: center;
}

.dropdown-field-row .dropdown-input {
  flex: 1;
}

.dropdown-vault-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid rgba(146, 169, 214, 0.2);
  border-radius: 6px;
  background: rgba(7, 17, 28, 0.8);
  color: rgba(237, 243, 255, 0.5);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
  flex-shrink: 0;
}

.dropdown-vault-btn:hover {
  background: rgba(100, 140, 255, 0.2);
  color: #8da6ff;
}

.dropdown-notice {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.25rem 0.4rem;
  border-radius: 6px;
  background: rgba(40, 190, 120, 0.1);
  color: #4ade80;
  font-size: 0.68rem;
}

.dropdown-divider {
  height: 1px;
  margin: 0.3rem 0;
  background: rgba(146, 169, 214, 0.15);
}

.dropdown-title--sub {
  margin-top: 0.2rem;
}

.dropdown-hint {
  margin: 0 0 0.3rem;
  font-size: 0.65rem;
  color: rgba(237, 243, 255, 0.4);
  line-height: 1.4;
}

.vault-key-list {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  max-height: 160px;
  overflow-y: auto;
}

.vault-key-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.3rem;
  padding: 0.25rem 0.4rem;
  border-radius: 6px;
  background: rgba(7, 17, 28, 0.6);
}

.vault-key-info {
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
  flex: 1;
  min-width: 0;
}

.vault-key-provider {
  font-size: 0.68rem;
  font-weight: 600;
  color: rgba(237, 243, 255, 0.7);
}

.vault-key-ref {
  font-size: 0.6rem;
  font-family: monospace;
  color: rgba(237, 243, 255, 0.35);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vault-key-time {
  font-size: 0.58rem;
  color: rgba(237, 243, 255, 0.3);
}

.vault-key-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: rgba(237, 243, 255, 0.3);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s ease, color 0.15s ease;
}

.vault-key-remove:hover {
  background: rgba(240, 80, 80, 0.15);
  color: #f87171;
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

.topbar__path {
  font-size: 0.68rem;
  color: rgba(237, 237, 255, 0.5);
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-chip--loading {
  background: rgba(100, 140, 255, 0.15);
  color: #8da6ff;
}

.status-chip--success {
  background: rgba(40, 190, 120, 0.15);
  color: #4ade80;
}

.status-chip--error {
  background: rgba(240, 80, 80, 0.15);
  color: #f87171;
}

/* ─── System Message Bar ───────────────────────────────────── */

.topbar__system-message {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex: 0 1 auto;
  min-width: 0;
  max-width: 360px;
  margin: 0 0.5rem 0 0;
  padding: 0.25rem 0.5rem;
  border-radius: 8px;
  border: 1px solid transparent;
  font-size: 0.7rem;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  animation: sysmsg-fade-in 0.2s ease-out;
}

@keyframes sysmsg-fade-in {
  from { opacity: 0; transform: translateY(-2px); }
  to { opacity: 1; transform: translateY(0); }
}

.topbar__system-message--info {
  background: rgba(100, 140, 255, 0.08);
  border-color: rgba(100, 140, 255, 0.18);
  color: #b8c8f8;
}

.topbar__system-message--success {
  background: rgba(40, 190, 120, 0.08);
  border-color: rgba(40, 190, 120, 0.18);
  color: #6de8a8;
}

.topbar__system-message--warning {
  background: rgba(240, 180, 60, 0.08);
  border-color: rgba(240, 180, 60, 0.18);
  color: #f0c040;
}

.topbar__system-message--error {
  background: rgba(240, 80, 80, 0.08);
  border-color: rgba(240, 80, 80, 0.18);
  color: #f87171;
}

.topbar__system-message-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.topbar__system-message-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topbar__system-message-close {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: rgba(237, 243, 255, 0.4);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.topbar__system-message-close:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #edf3ff;
}
</style>
