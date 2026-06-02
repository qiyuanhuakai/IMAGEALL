<script setup lang="ts">
import type { Artifact } from '@imageall/core'
import { resolveArtifactUri } from '../lib/api'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{
  selectedArtifact: Artifact | undefined
  fallbackWidth?: number
  fallbackHeight?: number
}>()

function displaySize(artifact: Artifact): string {
  const w = artifact.width > 0 ? artifact.width : props.fallbackWidth
  const h = artifact.height > 0 ? artifact.height : props.fallbackHeight
  if (w && h) return `${w}×${h}`
  return t('stage.unknownSize')
}
</script>

<template>
  <section class="panel stage-panel">
    <div v-if="selectedArtifact" class="stage-hero">
      <img :src="resolveArtifactUri(selectedArtifact.uri)" :alt="selectedArtifact.title" />
      <div class="stage-hero__meta">
        <strong>{{ selectedArtifact.title }}</strong>
        <span>{{ selectedArtifact.metadata.provider }} / {{ selectedArtifact.metadata.model }} · {{ displaySize(selectedArtifact) }}</span>
      </div>
    </div>

    <div v-else class="stage-empty">
      {{ $t('stage.empty') }}
    </div>
  </section>
</template>
