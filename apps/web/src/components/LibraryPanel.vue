<script setup lang="ts">
import type { Artifact, Run, Workspace } from '@imageall/core'
import { resolveArtifactUri } from '../lib/api'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

defineProps<{
  workspace: Workspace | undefined
  artifacts: Artifact[]
  runs: Run[]
  selectedArtifactId: string | undefined
}>()

const emit = defineEmits<{
  'update:selectedArtifactId': [value: string]
}>()
</script>

<template>
  <aside class="panel library-panel">
    <div class="section-heading">
      <div>
        <p class="eyebrow">{{ $t('library.title') }}</p>
        <h2>{{ workspace?.name }}</h2>
      </div>
      <span class="hint-pill">{{ $t('library.lineage') }}</span>
    </div>

    <section class="library-section">
      <div class="section-heading section-heading--compact">
        <h3>{{ $t('library.artifacts') }}</h3>
        <span>{{ artifacts.length }}</span>
      </div>

      <button
        v-for="artifact in artifacts"
        :key="artifact.id"
        class="artifact-row"
        :class="{ 'artifact-row--active': artifact.id === selectedArtifactId }"
        type="button"
        @click="emit('update:selectedArtifactId', artifact.id)"
      >
        <img :src="resolveArtifactUri(artifact.thumbnailUri ?? artifact.uri)" :alt="artifact.title" />
        <div>
          <strong>{{ artifact.title }}</strong>
          <p>{{ artifact.kind }} · {{ artifact.width > 0 && artifact.height > 0 ? `${artifact.width}×${artifact.height}` : $t('stage.unknownSize') }}</p>
        </div>
      </button>
    </section>

    <section class="library-section">
      <div class="section-heading section-heading--compact">
        <h3>{{ $t('library.runs') }}</h3>
        <span>{{ runs.length }}</span>
      </div>

      <div v-for="run in runs.slice().reverse()" :key="run.id" class="run-card">
        <div class="run-card__top">
          <strong>{{ run.providerId }} / {{ run.modelId }}</strong>
          <span class="run-status" :data-status="run.status">{{ $t(`status.${run.status}`) }}</span>
        </div>
        <p>{{ run.operation.kind }} · {{ run.createdAt.slice(11, 16) }}</p>
      </div>
    </section>
  </aside>
</template>
