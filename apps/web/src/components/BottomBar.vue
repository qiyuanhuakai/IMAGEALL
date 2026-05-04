<script setup lang="ts">
import { computed, ref } from 'vue'
import type {
  LocaleCode,
  LocaleOption,
  OperationKind,
  PreparedRunPlan,
  ProviderManifest,
  ProviderModelManifest,
  ProviderOptionDefinition,
  Workspace,
} from '@imageall/core'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  locales: LocaleOption[]
  workspaces: Workspace[]
  providers: ProviderManifest[]
  models: ProviderModelManifest[]
  selectedWorkspaceId: string | undefined
  selectedProviderId: string
  selectedModelId: string
  selectedLocale: LocaleCode
  usingFallbackData: boolean
  selectedOperation: OperationKind
  prompt: string
  negativePrompt: string
  supportsNegativePrompt: boolean
  aspectRatio: string
  width: number
  height: number
  seed: number
  sourceImageTitle: string | undefined
  sourceImageFilename: string | undefined
  activeModel: ProviderModelManifest | undefined
  availableSizePresets: Array<{ width: number; height: number }>
  supportedAspectRatios: string[]
  supportsCustomSize: boolean
  supportsMultiImage: boolean
  numImages: number
  maxImages: number
  providerOptions: Record<string, string | number | boolean>
  providerOptionDefinitions: ProviderOptionDefinition[]
  latestPlan: PreparedRunPlan | undefined
  lastRunError: string | undefined
  lastRunMessage: string | undefined
  isPreparingRun: boolean
  isExecutingRun: boolean
}>()

const emit = defineEmits([
  'update:selectedWorkspaceId',
  'update:selectedProviderId',
  'update:selectedModelId',
  'update:selectedLocale',
  'update:selectedOperation',
  'update:prompt',
  'update:negativePrompt',
  'update:aspectRatio',
  'update:width',
  'update:height',
  'update:seed',
  'apply:sizePreset',
  'update:providerOption',
  'update:sourceImageFile',
  'update:numImages',
  'run',
])

const { t } = useI18n()

const allOperations: OperationKind[] = ['generate', 'edit', 'upscale']

const availableOperations = computed(() => {
  const supported = props.activeModel?.operations ?? allOperations
  return allOperations.filter((op) => supported.includes(op))
})

const showParameters = ref(false)
const showProviderOptions = ref(false)

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
</script>

<template>
  <footer class="bottom-bar">
    <!-- Row 1: Provider / Model + Operation pills -->
    <div class="bb-row bb-row--controls">
      <div class="bb-selectors">
        <label class="bb-select">
          <span>{{ $t('topbar.provider') }}</span>
          <select
            :value="props.selectedProviderId"
            @change="emit('update:selectedProviderId', ($event.target as HTMLSelectElement).value)"
          >
            <option v-for="provider in props.providers" :key="provider.id" :value="provider.id">
              {{ provider.label }}
            </option>
          </select>
        </label>

        <label class="bb-select">
          <span>{{ $t('topbar.model') }}</span>
          <select
            :value="props.selectedModelId"
            @change="emit('update:selectedModelId', ($event.target as HTMLSelectElement).value)"
          >
            <option v-for="model in props.models" :key="model.id" :value="model.id">
              {{ model.label }}
            </option>
          </select>
        </label>
      </div>

      <div class="bb-operations">
        <button
          v-for="operation in availableOperations"
          :key="operation"
          class="pill-button"
          :class="{ 'pill-button--active': operation === props.selectedOperation }"
          type="button"
          @click="emit('update:selectedOperation', operation)"
        >
          {{ $t(`operations.${operation}`) }}
        </button>
      </div>
    </div>

    <!-- Row 2: Prompt + Run -->
    <div class="bb-row bb-row--prompt">
      <textarea
        class="bb-prompt"
        :value="props.prompt"
        rows="2"
        :placeholder="$t('inspector.prompt')"
        @input="emit('update:prompt', ($event.target as HTMLTextAreaElement).value)"
      />
      <button
        class="bb-run-btn"
        :disabled="props.isPreparingRun || props.isExecutingRun"
        type="button"
        @click="emit('run')"
      >
        <span class="bb-run-btn__icon">{{ props.isPreparingRun || props.isExecutingRun ? '◌' : '▶' }}</span>
        <span>{{ props.isPreparingRun || props.isExecutingRun ? $t('inspector.running') : $t('inspector.run') }}</span>
      </button>
    </div>

    <!-- Section: Common Parameters (collapsible) -->
    <div class="bb-section">
      <button class="bb-section-toggle" type="button" @click="showParameters = !showParameters">
        <span class="bb-section-arrow" :class="{ 'bb-section-arrow--open': showParameters }">▸</span>
        {{ $t('inspector.common') }}
      </button>

      <div v-show="showParameters" class="bb-section-body">
        <!-- Row: Size / Width / Height / Seed / NumImages -->
        <div class="bb-params-grid bb-params-grid--main">
          <label class="bb-param">
            <span>{{ $t('inspector.size') }}</span>
            <select
              v-if="props.supportedAspectRatios.length > 0"
              :value="props.aspectRatio"
              @change="emit('update:aspectRatio', ($event.target as HTMLSelectElement).value)"
            >
              <option
                v-for="ratio in props.supportedAspectRatios"
                :key="ratio"
                :value="ratio"
              >
                {{ ratio }}
              </option>
            </select>
            <select
              v-else
              :value="`${props.width}x${props.height}`"
              @change="onSizeSelect"
            >
              <option
                v-for="preset in props.availableSizePresets"
                :key="`${preset.width}x${preset.height}`"
                :value="`${preset.width}x${preset.height}`"
              >
                {{ preset.width }} × {{ preset.height }}
              </option>
            </select>
            <small v-if="props.aspectRatio && props.supportedAspectRatios.length > 0">{{ props.aspectRatio }}</small>
          </label>

          <template v-if="props.supportsCustomSize">
            <label class="bb-param">
              <span>{{ $t('inspector.width') }}</span>
              <input
                :value="props.width"
                type="number"
                @input="emit('update:width', Number(($event.target as HTMLInputElement).value))"
              />
            </label>
            <label class="bb-param">
              <span>{{ $t('inspector.height') }}</span>
              <input
                :value="props.height"
                type="number"
                @input="emit('update:height', Number(($event.target as HTMLInputElement).value))"
              />
            </label>
          </template>

          <label class="bb-param">
            <span>{{ $t('inspector.seed') }}</span>
            <div class="seed-input-row">
              <input
                :value="props.seed"
                type="number"
                @input="emit('update:seed', Number(($event.target as HTMLInputElement).value))"
              />
              <button class="seed-dice-btn" type="button" :title="$t('inspector.randomSeed')" @click="emit('update:seed', Math.floor(Math.random() * 2147483647))">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2" ry="2"/><circle cx="8" cy="8" r="1.5" fill="currentColor"/><circle cx="16" cy="8" r="1.5" fill="currentColor"/><circle cx="8" cy="16" r="1.5" fill="currentColor"/><circle cx="16" cy="16" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>
              </button>
            </div>
          </label>

          <label v-if="props.supportsMultiImage" class="bb-param">
            <span>{{ $t('inspector.numImages') }}</span>
            <input
              :value="props.numImages"
              type="number"
              min="1"
              :max="props.maxImages"
              @input="emit('update:numImages', Number(($event.target as HTMLInputElement).value))"
            />
          </label>
        </div>

        <!-- Negative prompt (only for providers that support it) -->
        <label v-if="props.supportsNegativePrompt" class="bb-param">
          <span>{{ $t('inspector.negativePrompt') }}</span>
          <textarea
            :value="props.negativePrompt"
            rows="2"
            @input="emit('update:negativePrompt', ($event.target as HTMLTextAreaElement).value)"
          />
        </label>

        <!-- Source image + Upload row -->
        <div v-if="props.selectedOperation === 'edit' || props.selectedOperation === 'upscale'" class="bb-extra-row">
          <div class="bb-param">
            <span>{{ $t('inspector.sourceImage') }}</span>
            <div class="source-chip">
              <strong>{{ props.sourceImageTitle ?? '—' }}</strong>
            </div>
          </div>

          <label v-if="props.selectedOperation === 'edit'" class="bb-param">
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
            <small>{{ props.sourceImageFilename ?? $t('inspector.uploadHint') }}</small>
          </label>
        </div>
      </div>
    </div>

    <!-- Section: Provider Options (collapsible) -->
    <div v-if="props.providerOptionDefinitions.length" class="bb-section">
      <button class="bb-section-toggle" type="button" @click="showProviderOptions = !showProviderOptions">
        <span class="bb-section-arrow" :class="{ 'bb-section-arrow--open': showProviderOptions }">▸</span>
        {{ $t('inspector.providerOptions') }}
      </button>

      <div v-show="showProviderOptions" class="bb-section-body">
        <div class="bb-params-grid bb-params-grid--provider">
          <label v-for="option in props.providerOptionDefinitions" :key="option.id" class="bb-param">
            <span>{{ optionLabel(option.id) }}</span>

            <select
              v-if="option.control === 'select'"
              :value="props.providerOptions[option.id]"
              @change="emit('update:providerOption', { id: option.id, value: ($event.target as HTMLSelectElement).value })"
            >
              <option v-for="selectOption in option.options" :key="selectOption.value" :value="selectOption.value">
                {{ t(`providerOptions.${option.id}${selectOption.value}`, selectOption.label) }}
              </option>
            </select>

            <input
              v-else-if="option.control === 'number'"
              :value="props.providerOptions[option.id]"
              :min="option.min"
              :max="option.max"
              :step="option.step"
              type="number"
              @input="emit('update:providerOption', { id: option.id, value: Number(($event.target as HTMLInputElement).value) })"
            />

            <input
              v-else-if="option.control === 'text'"
              :value="String(props.providerOptions[option.id] ?? '')"
              @input="emit('update:providerOption', { id: option.id, value: ($event.target as HTMLInputElement).value })"
            />

            <label v-else class="checkbox-field">
              <input
                :checked="Boolean(props.providerOptions[option.id])"
                type="checkbox"
                @change="emit('update:providerOption', { id: option.id, value: ($event.target as HTMLInputElement).checked })"
              />
              <span>{{ optionDesc(option.id) }}</span>
            </label>

            <small v-if="option.control !== 'boolean'">{{ optionDesc(option.id) }}</small>
          </label>
        </div>
      </div>
    </div>


  </footer>
</template>
