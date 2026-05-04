<script setup lang="ts">
import { computed } from 'vue'
import type { OperationKind, PreparedRunPlan, ProviderModelManifest, ProviderOptionDefinition } from '@imageall/core'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  selectedOperation: OperationKind
  prompt: string
  negativePrompt: string
  aspectRatio: string
  width: number
  height: number
  seed: number
  sourceImageTitle: string | undefined
  sourceImageFilename: string | undefined
  activeModel: ProviderModelManifest | undefined
  availableSizePresets: Array<{ width: number; height: number }>
  supportsCustomSize: boolean
  supportsMultiImage: boolean
  numImages: number
  maxImages: number
  providerOptions: Record<string, string | number | boolean>
  providerOptionDefinitions: ProviderOptionDefinition[]
  apiKey: string
  latestPlan: PreparedRunPlan | undefined
  lastRunError: string | undefined
  lastRunMessage: string | undefined
  isPreparingRun: boolean
  isExecutingRun: boolean
}>()

const emit = defineEmits([
  'update:selectedOperation',
  'update:prompt',
  'update:negativePrompt',
  'update:aspectRatio',
  'update:width',
  'update:height',
  'update:seed',
  'update:numImages',
  'apply:sizePreset',
  'update:providerOption',
  'update:sourceImageFile',
  'update:apiKey',
  'run',
])

const { t } = useI18n()

function optionLabel(id: string): string {
  return t(`providerOptions.${id}`, id)
}

function optionDesc(id: string): string {
  return t(`providerOptions.${id}Desc`, '')
}

function onSizeSelect(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  const [w, h] = value.split('x').map(Number)
  emit('update:width', w)
  emit('update:height', h)
}

const allOperations: OperationKind[] = ['generate', 'edit', 'upscale']

const availableOperations = computed(() => {
  const supported = props.activeModel?.operations ?? allOperations
  return allOperations.filter((op) => supported.includes(op))
})
</script>

<template>
  <aside class="panel inspector-panel">
    <div class="section-heading">
      <div>
        <p class="eyebrow">{{ $t('inspector.title') }}</p>
        <h2>{{ activeModel?.label }}</h2>
      </div>
    </div>

    <section class="inspector-section">
      <div class="section-heading section-heading--compact">
        <h3>{{ $t('inspector.operation') }}</h3>
      </div>
      <div class="pill-row">
        <button
          v-for="operation in availableOperations"
          :key="operation"
          class="pill-button"
          :class="{ 'pill-button--active': operation === selectedOperation }"
          type="button"
          @click="emit('update:selectedOperation', operation)"
        >
          {{ $t(`operations.${operation}`) }}
        </button>
      </div>
    </section>

    <section class="inspector-section">
      <div class="section-heading section-heading--compact">
        <h3>{{ $t('inspector.common') }}</h3>
      </div>

      <label class="field">
        <span>{{ $t('inspector.prompt') }}</span>
        <textarea :value="prompt" rows="5" @input="emit('update:prompt', ($event.target as HTMLTextAreaElement).value)" />
      </label>

      <label class="field">
        <span>{{ $t('inspector.apiKey') }}</span>
        <input
          :value="apiKey"
          autocomplete="off"
          placeholder="sk-..."
          type="password"
          @input="emit('update:apiKey', ($event.target as HTMLInputElement).value)"
        />
        <small>{{ $t('inspector.apiKeyNote') }}</small>
      </label>

      <label class="field">
        <span>{{ $t('inspector.negativePrompt') }}</span>
        <textarea
          :value="negativePrompt"
          rows="3"
          @input="emit('update:negativePrompt', ($event.target as HTMLTextAreaElement).value)"
        />
      </label>

      <label class="field">
        <span>{{ $t('inspector.size') }}</span>
        <select
          :value="`${width}x${height}`"
          @change="onSizeSelect"
          class="bb-select"
        >
          <option
            v-for="preset in availableSizePresets"
            :key="`${preset.width}x${preset.height}`"
            :value="`${preset.width}x${preset.height}`"
          >
            {{ preset.width }} × {{ preset.height }}
          </option>
        </select>
        <small v-if="width && height">{{ width }} × {{ height }}{{ aspectRatio ? ` (${aspectRatio})` : '' }}</small>
      </label>

      <div v-if="supportsCustomSize" class="field-grid">
        <label class="field">
          <span>{{ $t('inspector.width') }}</span>
          <input :value="width" type="number" @input="emit('update:width', Number(($event.target as HTMLInputElement).value))" />
        </label>
        <label class="field">
          <span>{{ $t('inspector.height') }}</span>
          <input :value="height" type="number" @input="emit('update:height', Number(($event.target as HTMLInputElement).value))" />
        </label>
      </div>

      <div class="field-grid">
        <label class="field">
          <span>{{ $t('inspector.seed') }}</span>
          <div class="seed-input-row">
            <input :value="seed" type="number" @input="emit('update:seed', Number(($event.target as HTMLInputElement).value))" />
            <button class="seed-dice-btn" type="button" :title="$t('inspector.randomSeed')" @click="emit('update:seed', Math.floor(Math.random() * 2147483647))">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2" ry="2"/><circle cx="8" cy="8" r="1.5" fill="currentColor"/><circle cx="16" cy="8" r="1.5" fill="currentColor"/><circle cx="8" cy="16" r="1.5" fill="currentColor"/><circle cx="16" cy="16" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>
            </button>
          </div>
        </label>

        <label v-if="supportsMultiImage" class="field">
          <span>{{ $t('inspector.numImages') }}</span>
          <input :value="numImages" type="number" min="1" :max="maxImages" @input="emit('update:numImages', Number(($event.target as HTMLInputElement).value))" />
        </label>
      </div>

      <template v-if="selectedOperation === 'edit' || selectedOperation === 'upscale'">
        <div class="source-chip">
          <span>{{ $t('inspector.sourceImage') }}</span>
          <strong>{{ sourceImageTitle ?? '—' }}</strong>
        </div>

        <label v-if="selectedOperation === 'edit'" class="field">
          <span>{{ $t('inspector.uploadSource') }}</span>
          <input
            accept="image/png,image/jpeg,image/webp"
            type="file"
            @change="
              ($event) => {
                const file = ($event.target as HTMLInputElement).files?.[0]
                if (file) emit('update:sourceImageFile', file)
              }
            "
          />
          <small>{{ sourceImageFilename ?? $t('inspector.uploadHint') }}</small>
        </label>
      </template>
    </section>

    <section class="inspector-section">
      <div class="section-heading section-heading--compact">
        <h3>{{ $t('inspector.providerOptions') }}</h3>
      </div>

      <label v-for="option in providerOptionDefinitions" :key="option.id" class="field">
        <span>{{ optionLabel(option.id) }}</span>

        <select
          v-if="option.control === 'select'"
          :value="providerOptions[option.id]"
          @change="emit('update:providerOption', { id: option.id, value: ($event.target as HTMLSelectElement).value })"
        >
          <option v-for="selectOption in option.options" :key="selectOption.value" :value="selectOption.value">
            {{ t(`providerOptions.${option.id}${selectOption.value}`, selectOption.label) }}
          </option>
        </select>

        <input
          v-else-if="option.control === 'number'"
          :value="providerOptions[option.id]"
          :min="option.min"
          :max="option.max"
          :step="option.step"
          type="number"
          @input="emit('update:providerOption', { id: option.id, value: Number(($event.target as HTMLInputElement).value) })"
        />

        <input
          v-else-if="option.control === 'text'"
          :value="String(providerOptions[option.id] ?? '')"
          @input="emit('update:providerOption', { id: option.id, value: ($event.target as HTMLInputElement).value })"
        />

        <label v-else class="checkbox-field">
          <input
            :checked="Boolean(providerOptions[option.id])"
            type="checkbox"
            @change="emit('update:providerOption', { id: option.id, value: ($event.target as HTMLInputElement).checked })"
          />
          <span>{{ optionDesc(option.id) }}</span>
        </label>

        <small v-if="option.control !== 'boolean'">{{ optionDesc(option.id) }}</small>
      </label>
    </section>

    <section class="inspector-section inspector-section--action glass-panel">
      <p>{{ $t('inspector.providerNote') }}</p>

      <div v-if="latestPlan" class="plan-card">
        <strong>{{ $t('inspector.planReady') }}</strong>
        <p>{{ latestPlan.providerId }} / {{ latestPlan.modelId }}</p>
        <small>{{ latestPlan.requestPreview.bodyType }} · {{ latestPlan.requestPreview.url }}</small>
      </div>

      <p v-if="lastRunMessage" class="runtime-message runtime-message--ok">{{ lastRunMessage }}</p>
      <p v-if="lastRunError" class="runtime-message runtime-message--error">{{ lastRunError }}</p>

      <button class="primary-button" :disabled="isPreparingRun || isExecutingRun" type="button" @click="emit('run')">
        {{ isPreparingRun || isExecutingRun ? $t('inspector.running') : $t('inspector.run') }}
      </button>
    </section>
  </aside>
</template>
