<script setup lang="ts">
import type { Run } from '@imageall/core'

defineProps<{
  runs: Run[]
}>()
</script>

<template>
  <section class="panel tray-panel">
    <div class="section-heading">
      <div>
        <p class="eyebrow">{{ $t('tray.title') }}</p>
        <h2>{{ $t('tray.queue') }}</h2>
      </div>
    </div>

    <div class="tray-grid">
      <article v-for="run in runs.slice().reverse()" :key="run.id" class="tray-card glass-panel">
        <div class="tray-card__top">
          <strong>{{ run.operation.kind }}</strong>
          <span class="run-status" :data-status="run.status">{{ $t(`status.${run.status}`) }}</span>
        </div>
        <p>{{ $t('tray.provider') }} · {{ run.providerId }} / {{ run.modelId }}</p>
        <p>{{ run.logs.at(-1)?.message ?? '—' }}</p>
      </article>
    </div>
  </section>
</template>
