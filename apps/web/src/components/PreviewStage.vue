<script setup lang="ts">
import type { Artifact } from '@imageall/core'
import { resolveArtifactUri } from '../lib/api'

defineProps<{
  selectedArtifact: Artifact | undefined
}>()
</script>

<template>
  <section class="panel stage-panel">
    <div v-if="selectedArtifact" class="stage-hero">
      <img :src="resolveArtifactUri(selectedArtifact.uri)" :alt="selectedArtifact.title" />
      <div class="stage-hero__meta">
        <strong>{{ selectedArtifact.title }}</strong>
        <span>{{ selectedArtifact.metadata.provider }} / {{ selectedArtifact.metadata.model }} · {{ selectedArtifact.width && selectedArtifact.height ? `${selectedArtifact.width}×${selectedArtifact.height}` : $t('stage.unknownSize') }}</span>
      </div>
    </div>

    <div v-else class="stage-empty">
      {{ $t('stage.empty') }}
    </div>
  </section>
</template>
