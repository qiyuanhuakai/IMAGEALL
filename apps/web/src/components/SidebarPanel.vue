<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Artifact, Run, Workspace } from '@imageall/core'

type SidebarTab = 'artifacts' | 'history'

const props = defineProps<{
  workspace: Workspace | undefined
  artifacts: Artifact[]
  runs: Run[]
  selectedArtifactId: string | undefined
}>()

const emit = defineEmits<{
  'update:selectedArtifactId': [value: string]
  'resize:start': [event: MouseEvent]
}>()

const activeTab = ref<SidebarTab>('artifacts')

const tabs: Array<{ id: SidebarTab; labelKey: string; icon: string }> = [
  { id: 'artifacts', labelKey: 'sidebar.tabs.artifacts', icon: '◈' },
  { id: 'history', labelKey: 'sidebar.tabs.history', icon: '▸' },
]

const sortedRuns = computed(() => [...props.runs].reverse())

function formatRunTime(iso: string): string {
  try {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  } catch {
    return iso.slice(11, 19)
  }
}
</script>

<template>
  <aside class="sidebar-panel">
    <div class="sidebar-header">
      <h2 class="sidebar-header__name">{{ workspace?.name ?? 'ImageAll' }}</h2>
    </div>

    <nav class="sidebar-tabs" role="tablist">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="sidebar-tab"
        :class="{ 'sidebar-tab--active': activeTab === tab.id }"
        role="tab"
        :aria-selected="activeTab === tab.id"
        type="button"
        @click="activeTab = tab.id"
      >
        <span class="sidebar-tab__icon">{{ tab.icon }}</span>
        <span class="sidebar-tab__label">{{ $t(tab.labelKey) }}</span>
        <span v-if="tab.id === 'artifacts'" class="sidebar-tab__count">{{ artifacts.length }}</span>
        <span v-else-if="tab.id === 'history'" class="sidebar-tab__count">{{ runs.length }}</span>
      </button>
    </nav>

    <div class="sidebar-content">
      <div v-show="activeTab === 'artifacts'" class="sidebar-tab-panel" role="tabpanel">
        <div class="sidebar-list">
          <button
            v-for="artifact in artifacts"
            :key="artifact.id"
            class="sidebar-item"
            :class="{ 'sidebar-item--active': artifact.id === selectedArtifactId }"
            type="button"
            @click="emit('update:selectedArtifactId', artifact.id)"
          >
            <img
              v-if="artifact.thumbnailUri ?? artifact.uri"
              :src="artifact.thumbnailUri ?? artifact.uri"
              :alt="artifact.title"
              class="sidebar-item__thumb"
            />
            <div class="sidebar-item__body">
              <strong class="sidebar-item__title">{{ artifact.title }}</strong>
              <p class="sidebar-item__meta">{{ $t(`artifactKind.${artifact.kind}`) }} · {{ artifact.width && artifact.height ? `${artifact.width}×${artifact.height}` : $t('stage.unknownSize') }}</p>
            </div>
          </button>
          <p v-if="!artifacts.length" class="sidebar-empty">{{ $t('stage.empty') }}</p>
        </div>
      </div>

      <div v-show="activeTab === 'history'" class="sidebar-tab-panel" role="tabpanel">
        <div class="sidebar-list">
          <div
            v-for="run in sortedRuns"
            :key="run.id"
            class="sidebar-item sidebar-item--card"
          >
            <div class="sidebar-item__header">
              <strong class="sidebar-item__title">{{ run.providerId }} / {{ run.modelId }}</strong>
              <span class="run-status" :data-status="run.status">{{ $t(`status.${run.status}`) }}</span>
            </div>
            <p class="sidebar-item__meta">{{ $t(`operations.${run.operation.kind}`) }} · {{ formatRunTime(run.createdAt) }}</p>
          </div>
          <p v-if="!runs.length" class="sidebar-empty">{{ $t('stage.empty') }}</p>
        </div>
      </div>
    </div>

    <div class="sidebar-resize-handle" @mousedown="emit('resize:start', $event)" />
  </aside>
</template>

<style scoped>
.sidebar-empty {
  padding: 1rem;
  text-align: center;
  color: rgba(237, 243, 255, 0.4);
  font-size: 0.75rem;
}
</style>
