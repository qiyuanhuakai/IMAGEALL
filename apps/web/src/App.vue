<script setup lang="ts">
import { watch } from 'vue'
import { useI18n } from 'vue-i18n'

import WorkbenchTopBar from './components/WorkbenchTopBar.vue'
import LibraryPanel from './components/LibraryPanel.vue'
import PreviewStage from './components/PreviewStage.vue'
import InspectorPanel from './components/InspectorPanel.vue'
import RunTray from './components/RunTray.vue'
import { useWorkbench } from './composables/useWorkbench'

const { locale } = useI18n()

const workbench = useWorkbench()

watch(
  () => workbench.selectedLocale.value,
  (nextLocale) => {
    locale.value = nextLocale
  },
  { immediate: true },
)
</script>

<template>
  <div
    class="app-shell"
    :style="{
      '--provider-accent': workbench.activeProvider.value?.accent ?? '#8ab4ff',
    }"
  >
    <WorkbenchTopBar
      :locales="workbench.locales.value"
      :workspaces="workbench.workspaces.value"
      :providers="workbench.providers.value"
      :models="workbench.activeProvider.value?.models ?? []"
      :selected-workspace-id="workbench.selectedWorkspaceId.value"
      :selected-provider-id="workbench.selectedProviderId.value"
      :selected-model-id="workbench.selectedModelId.value"
      :selected-locale="workbench.selectedLocale.value"
      :using-fallback-data="workbench.isUsingFallbackData.value"
      @update:selected-locale="workbench.selectedLocale.value = $event"
      @update:selected-model-id="workbench.selectedModelId.value = $event"
      @update:selected-provider-id="workbench.selectedProviderId.value = $event"
      @update:selected-workspace-id="workbench.selectedWorkspaceId.value = $event"
    />

    <main class="workbench-grid">
      <LibraryPanel
        :workspace="workbench.workspace.value"
        :artifacts="workbench.artifacts.value"
        :runs="workbench.runs.value"
        :selected-artifact-id="workbench.selectedArtifactId.value"
        @update:selected-artifact-id="workbench.selectedArtifactId.value = $event"
      />

      <PreviewStage
        :selected-artifact="workbench.selectedArtifact.value"
        :compare-artifacts="workbench.compareArtifacts.value"
        :live-outputs="workbench.liveOutputArtifacts.value"
        :recent-outputs="workbench.recentOutputArtifacts.value"
      />

      <InspectorPanel
        :selected-operation="workbench.selectedOperation.value"
        :prompt="workbench.prompt.value"
        :negative-prompt="workbench.negativePrompt.value"
        :aspect-ratio="workbench.aspectRatio.value"
        :width="workbench.width.value"
        :height="workbench.height.value"
        :num-images="workbench.numImages.value"
        :seed="workbench.seed.value"
        :source-image-title="workbench.selectedArtifact.value?.title"
        :source-image-filename="workbench.sourceImageFilename.value"
        :active-model="workbench.activeModel.value"
        :available-size-presets="workbench.availableSizePresets.value"
        :provider-options="workbench.providerOptions.value"
        :provider-option-definitions="workbench.currentProviderOptions.value"
        :api-key="workbench.apiKey.value"
        :latest-plan="workbench.latestPlan.value"
        :last-run-error="workbench.lastRunError.value"
        :last-run-message="workbench.lastRunMessage.value"
        :is-preparing-run="workbench.isPreparingRun.value"
        :is-executing-run="workbench.isExecutingRun.value"
        @update:selected-operation="workbench.selectedOperation.value = $event"
        @update:prompt="workbench.prompt.value = $event"
        @update:negative-prompt="workbench.negativePrompt.value = $event"
        @update:aspect-ratio="workbench.aspectRatio.value = $event"
        @update:width="workbench.width.value = $event"
        @update:height="workbench.height.value = $event"
        @update:num-images="workbench.numImages.value = $event"
        @update:seed="workbench.seed.value = $event"
        @apply:size-preset="({ width, height }) => { workbench.width.value = width; workbench.height.value = height }"
        @update:api-key="workbench.apiKey.value = $event"
        @update:source-image-file="workbench.updateSourceImage($event)"
        @update:provider-option="workbench.providerOptions.value[$event.id] = $event.value"
        @run="workbench.runPreparedExecution()"
      />
    </main>

    <RunTray :runs="workbench.runs.value" />
  </div>
</template>
