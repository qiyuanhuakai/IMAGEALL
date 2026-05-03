<script setup lang="ts">
import type { LocaleCode, LocaleOption, ProviderManifest, ProviderModelManifest, Workspace } from '@imageall/core'

defineProps<{
  locales: LocaleOption[]
  workspaces: Workspace[]
  providers: ProviderManifest[]
  models: ProviderModelManifest[]
  selectedWorkspaceId: string | undefined
  selectedProviderId: string
  selectedModelId: string
  selectedLocale: LocaleCode
  usingFallbackData: boolean
}>()

const emit = defineEmits<{
  'update:selectedWorkspaceId': [value: string]
  'update:selectedProviderId': [value: string]
  'update:selectedModelId': [value: string]
  'update:selectedLocale': [value: LocaleCode]
}>()

function isLocaleCode(value: string): value is LocaleCode {
  return value === 'en' || value === 'zh-CN'
}

function handleLocaleChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  if (isLocaleCode(value)) {
    emit('update:selectedLocale', value)
  }
}
</script>

<template>
  <header class="topbar panel glass-panel">
    <div class="topbar__brand">
      <div class="brand-mark" />
      <div>
        <p class="eyebrow">ImageAll</p>
        <h1>{{ $t('app.subtitle') }}</h1>
      </div>
    </div>

    <div class="topbar__controls">
      <label class="control">
        <span>{{ $t('topbar.workspace') }}</span>
        <select
          :value="selectedWorkspaceId"
          @change="emit('update:selectedWorkspaceId', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="workspace in workspaces" :key="workspace.id" :value="workspace.id">
            {{ workspace.name }}
          </option>
        </select>
      </label>

      <label class="control">
        <span>{{ $t('topbar.provider') }}</span>
        <select
          :value="selectedProviderId"
          @change="emit('update:selectedProviderId', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="provider in providers" :key="provider.id" :value="provider.id">
            {{ provider.label }}
          </option>
        </select>
      </label>

      <label class="control">
        <span>{{ $t('topbar.model') }}</span>
        <select
          :value="selectedModelId"
          @change="emit('update:selectedModelId', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="model in models" :key="model.id" :value="model.id">
            {{ model.label }}
          </option>
        </select>
      </label>

      <label class="control control--compact">
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
    </div>

    <div class="topbar__status">
      <span class="status-chip">{{ $t('app.statusDesign') }}</span>
      <span v-if="usingFallbackData" class="status-chip status-chip--muted">{{ $t('app.usingFallback') }}</span>
    </div>
  </header>
</template>
