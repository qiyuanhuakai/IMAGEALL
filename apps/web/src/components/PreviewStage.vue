<script setup lang="ts">
import type { Artifact } from '@imageall/core'

defineProps<{
  selectedArtifact: Artifact | undefined
  compareArtifacts: Artifact[]
  recentOutputs: Artifact[]
  liveOutputs: Artifact[]
}>()
</script>

<template>
  <section class="panel stage-panel">
    <div class="section-heading">
      <div>
        <p class="eyebrow">{{ $t('stage.selected') }}</p>
        <h2>{{ selectedArtifact?.title ?? $t('stage.empty') }}</h2>
      </div>
      <span class="hint-pill">{{ $t('stage.compare') }}</span>
    </div>

    <div v-if="selectedArtifact" class="stage-hero glass-panel">
      <img :src="selectedArtifact.uri" :alt="selectedArtifact.title" />
    </div>

    <div v-else class="stage-empty glass-panel">
      {{ $t('stage.empty') }}
    </div>

    <div class="compare-grid">
      <article v-for="artifact in compareArtifacts" :key="artifact.id" class="compare-card glass-panel">
        <img :src="artifact.uri" :alt="artifact.title" />
        <div>
          <strong>{{ artifact.title }}</strong>
          <p>{{ artifact.metadata.provider }} / {{ artifact.metadata.model }}</p>
        </div>
      </article>
    </div>

    <div class="section-heading section-heading--compact">
      <h3>{{ $t('stage.generated') }}</h3>
      <span>{{ recentOutputs.length }}</span>
    </div>

    <div v-if="liveOutputs.length" class="section-heading section-heading--compact">
      <h3>{{ $t('stage.liveOutputs') }}</h3>
      <span>{{ liveOutputs.length }}</span>
    </div>

    <div v-if="liveOutputs.length" class="output-grid output-grid--live">
      <article v-for="artifact in liveOutputs" :key="artifact.id" class="output-card glass-panel">
        <img :src="artifact.uri" :alt="artifact.title" />
        <div>
          <strong>{{ artifact.title }}</strong>
          <p>{{ artifact.metadata.provider }} / {{ artifact.metadata.model }}</p>
        </div>
      </article>
    </div>

    <div class="output-grid">
      <article v-for="artifact in recentOutputs" :key="artifact.id" class="output-card glass-panel">
        <img :src="artifact.uri" :alt="artifact.title" />
        <div>
          <strong>{{ artifact.title }}</strong>
          <p>{{ artifact.metadata.prompt }}</p>
        </div>
      </article>
    </div>
  </section>
</template>
