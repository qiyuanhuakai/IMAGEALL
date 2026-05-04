<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import WorkbenchTopBar from './components/WorkbenchTopBar.vue'
import SidebarPanel from './components/SidebarPanel.vue'
import PreviewStage from './components/PreviewStage.vue'
import BottomBar from './components/BottomBar.vue'
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

const sidebarWidth = ref(240)
const isResizing = ref(false)
const sidebarRef = ref<HTMLElement | null>(null)

function startResize(e: MouseEvent) {
  isResizing.value = true
  e.preventDefault()
  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', stopResize)
}

function onResize(e: MouseEvent) {
  if (!isResizing.value) return
  const newWidth = Math.max(160, Math.min(480, e.clientX - 8))
  sidebarWidth.value = newWidth
}

function stopResize() {
  isResizing.value = false
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', stopResize)
}
</script>

<template>
  <div
    class="app-shell"
    :style="{
      '--provider-accent': workbench.activeProvider.value?.accent ?? '#8ab4ff',
      '--sidebar-width': `${sidebarWidth}px`,
    }"
  >
    <WorkbenchTopBar
      :locales="workbench.locales.value"
      :workspaces="workbench.workspaces.value"
      :providers="workbench.providers.value"
      :selected-workspace-id="workbench.selectedWorkspaceId.value"
      :selected-locale="workbench.selectedLocale.value"
      :using-fallback-data="workbench.isUsingFallbackData.value"
      :is-restoring-workspace="workbench.isRestoringWorkspace.value"
      :restoration-status="workbench.restorationStatus.value"
      :restoration-error="workbench.restorationError.value"
      :workspace-path="workbench.workspacePath.value"
      @update:selected-locale="workbench.selectedLocale.value = $event"
      @update:selected-workspace-id="workbench.selectedWorkspaceId.value = $event"
      @update:provider-keys="workbench.updateProviderKeys($event)"
      @select:workspace-folder="workbench.setWorkspaceFolder($event)"
    />

    <main class="workbench-grid">
      <SidebarPanel
        :workspace="workbench.workspace.value"
        :artifacts="workbench.artifacts.value"
        :runs="workbench.runs.value"
        :selected-artifact-id="workbench.selectedArtifactId.value"
        @update:selected-artifact-id="workbench.selectedArtifactId.value = $event"
        @resize:start="startResize"
      />

      <div class="right-panel">
        <PreviewStage
          :selected-artifact="workbench.selectedArtifact.value"
        />

        <BottomBar
          :locales="workbench.locales.value"
          :workspaces="workbench.workspaces.value"
          :providers="workbench.providers.value"
          :models="workbench.activeProvider.value?.models ?? []"
          :selected-workspace-id="workbench.selectedWorkspaceId.value"
          :selected-provider-id="workbench.selectedProviderId.value"
          :selected-model-id="workbench.selectedModelId.value"
          :selected-locale="workbench.selectedLocale.value"
          :using-fallback-data="workbench.isUsingFallbackData.value"
          :selected-operation="workbench.selectedOperation.value"
          :prompt="workbench.prompt.value"
          :negative-prompt="workbench.negativePrompt.value"
          :aspect-ratio="workbench.aspectRatio.value"
          :width="workbench.width.value"
          :height="workbench.height.value"
          :seed="workbench.seed.value"
          :source-image-title="workbench.selectedArtifact.value?.title"
          :source-image-filename="workbench.sourceImageFilename.value"
          :active-model="workbench.activeModel.value"
          :available-size-presets="workbench.availableSizePresets.value"
          :supported-aspect-ratios="workbench.supportedAspectRatios.value"
          :supports-custom-size="workbench.supportsCustomSize.value ?? false"
          :supports-negative-prompt="workbench.supportsNegativePrompt.value !== false"
          :num-images="workbench.numImages.value"
          :max-images="workbench.maxImages.value"
          :provider-options="workbench.providerOptions.value"
          :provider-option-definitions="workbench.currentProviderOptions.value"
          :latest-plan="workbench.latestPlan.value"
          :last-run-error="workbench.lastRunError.value"
          :last-run-message="workbench.lastRunMessage.value"
          :is-preparing-run="workbench.isPreparingRun.value"
          :is-executing-run="workbench.isExecutingRun.value"
          @update:selected-locale="workbench.selectedLocale.value = $event"
          @update:selected-model-id="workbench.selectedModelId.value = $event"
          @update:selected-provider-id="workbench.selectedProviderId.value = $event"
          @update:selected-workspace-id="workbench.selectedWorkspaceId.value = $event"
          @update:selected-operation="workbench.selectedOperation.value = $event"
          @update:prompt="workbench.prompt.value = $event"
          @update:negative-prompt="workbench.negativePrompt.value = $event"
          @update:aspect-ratio="workbench.aspectRatio.value = $event"
          @update:width="workbench.width.value = $event"
          @update:height="workbench.height.value = $event"
          @update:seed="workbench.seed.value = $event"
          @update:num-images="workbench.numImages.value = $event"
          @apply:size-preset="({ width, height }) => { workbench.width.value = width; workbench.height.value = height }"
          @update:source-image-file="workbench.updateSourceImage($event)"
          @update:provider-option="workbench.providerOptions.value[$event.id] = $event.value"
          @run="workbench.runPreparedExecution()"
        />
      </div>
    </main>
  </div>
</template>
