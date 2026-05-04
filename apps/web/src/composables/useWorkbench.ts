import { computed, ref, watch } from 'vue'

import {
  type ImageInputSource,
  type OperationSpec,
  type PreparedRunPlan,
  type UnifiedRunInput,
  createDemoBootstrap,
  createProviderRegistry,
  getProviderOptions,
  type Artifact,
  type LocaleCode,
  type OperationKind,
  type ProviderManifest,
  type WorkbenchBootstrap,
} from '@imageall/core'

import { checkWorkspaceStatus, executePreparedRun, fetchBootstrap, prepareRun, restoreWorkspace } from '../lib/api'

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

function ratioLabel(width: number, height: number): string {
  const d = gcd(width, height)
  return `${width / d}:${height / d}`
}

type ProviderOptionValue = string | number | boolean

function normalizeProviderOptions(provider: ProviderManifest, modelId: string): Record<string, ProviderOptionValue> {
  return Object.fromEntries(
    getProviderOptions(provider, modelId).map((option) => [option.id, option.defaultValue]),
  )
}

export function useWorkbench() {
  const bootstrap = ref<WorkbenchBootstrap>(createDemoBootstrap())
  const isLoading = ref(true)
  const isUsingFallbackData = ref(true)
  const error = ref<string>()

  const selectedWorkspaceId = ref(bootstrap.value.selectedWorkspaceId)
  const selectedArtifactId = ref(bootstrap.value.workspaces[0]?.uiState.selectedArtifactId)
  const selectedOperation = ref<OperationKind>(bootstrap.value.workspaces[0]?.uiState.activeOperation ?? 'generate')
  const selectedProviderId = ref(bootstrap.value.workspaces[0]?.uiState.activeProviderId ?? bootstrap.value.providers[0]?.id ?? '')
  const selectedModelId = ref(bootstrap.value.workspaces[0]?.uiState.activeModelId ?? bootstrap.value.providers[0]?.defaultModelId ?? '')
  const selectedLocale = ref<LocaleCode>(bootstrap.value.workspaces[0]?.locale ?? 'zh-CN')

  const prompt = ref('A multilingual poster study with calm editorial rhythm and strong visual hierarchy.')
  const negativePrompt = ref('muddy contrast, broken text, generic composition')
  const aspectRatio = ref('4:3')
  const width = ref(1280)
  const height = ref(960)
  const numImages = ref(1)
  const seed = ref(94021)

  const providerOptions = ref<Record<string, ProviderOptionValue>>({})
  const apiKey = ref('')
  const providerKeys = ref<Record<string, string>>({})
  try {
    const raw = localStorage.getItem('imageall_provider_keys')
    if (raw) providerKeys.value = JSON.parse(raw)
  } catch { /* ignore */ }
  const sourceImageDataUrl = ref('')
  const sourceImageFilename = ref('source.png')
  const latestPlan = ref<PreparedRunPlan>()
  const lastRunError = ref<string>()
  const lastRunMessage = ref<string>()
  const isPreparingRun = ref(false)
  const isExecutingRun = ref(false)
  const liveOutputs = ref<Array<{ uri?: string; base64?: string; mimeType?: string; seed?: number }>>([])

  const savedWorkspaceFolder = localStorage.getItem('imageall_workspace_folder')

  const isRestoringWorkspace = ref(false)
  const restorationStatus = ref<string>()
  const restorationError = ref<string>()
  const workspacePath = ref<string>(savedWorkspaceFolder ?? '')

  const registry = computed(() => createProviderRegistry(bootstrap.value.providers))
  const locales = computed(() => bootstrap.value.locales)
  const providers = computed(() => bootstrap.value.providers)
  const workspaces = computed(() => bootstrap.value.workspaces)
  const workspace = computed(() => workspaces.value.find((entry) => entry.id === selectedWorkspaceId.value) ?? workspaces.value[0])
  const artifacts = computed(() => bootstrap.value.artifacts)
  const runs = computed(() => bootstrap.value.runs)
  const activeProvider = computed(() => providers.value.find((provider) => provider.id === selectedProviderId.value) ?? providers.value[0])
  const activeModel = computed(() => activeProvider.value?.models.find((model) => model.id === selectedModelId.value) ?? activeProvider.value?.models[0])
  const selectedArtifact = computed(() => artifacts.value.find((artifact) => artifact.id === selectedArtifactId.value) ?? artifacts.value[0])
  const compareArtifacts = computed(() => {
    const compareIds = workspace.value?.uiState.compareArtifactIds ?? []
    return compareIds
      .map((artifactId) => artifacts.value.find((artifact) => artifact.id === artifactId))
      .filter((artifact): artifact is Artifact => Boolean(artifact))
  })
  const recentOutputArtifacts = computed(() => artifacts.value.filter((artifact) => artifact.kind !== 'input').slice(-3).reverse())
  const currentProviderOptions = computed(() => (activeProvider.value ? getProviderOptions(activeProvider.value, selectedModelId.value) : []))
  const availableSizePresets = computed(() => activeModel.value?.constraints?.sizePresets ?? [])
  const supportedAspectRatios = computed(() => activeModel.value?.constraints?.supportedAspectRatios ?? [])
  const supportsCustomSize = computed(() => {
    const provider = activeProvider.value
    if (!provider) return true
    if (provider.capabilities.supportsCustomSize !== true) return false
    return activeModel.value?.constraints?.supportsCustomSize !== false
  })
  const supportsNegativePrompt = computed(() => {
    const provider = activeProvider.value
    if (!provider) return true
    return provider.capabilities.supportsNegativePrompt !== false
  })
  const maxImages = computed(() => activeModel.value?.constraints?.maxImages ?? 9)
  const selectedSourceImageInput = computed<ImageInputSource[] | undefined>(() => {
    if (!sourceImageDataUrl.value.trim()) {
      return undefined
    }

    return [
      {
        kind: 'data-url',
        value: sourceImageDataUrl.value,
        filename: sourceImageFilename.value,
      },
    ]
  })
  const liveOutputArtifacts = computed(() =>
    liveOutputs.value.map((output, index): Artifact => {
      const metadata: Artifact['metadata'] = {
        provider: selectedProviderId.value,
        model: selectedModelId.value,
        prompt: prompt.value,
        ...(output.seed !== undefined ? { seed: output.seed } : {}),
      }

      return {
        id: `live-output-${index}`,
        workspaceId: workspace.value?.id ?? 'live',
        kind: 'generated',
        title: `${activeProvider.value?.label ?? 'Provider'} live output ${index + 1}`,
        mimeType: output.base64 ? 'image/png' : 'image/jpeg',
        width: width.value,
        height: height.value,
        uri: output.uri ?? `data:image/png;base64,${output.base64}`,
        createdAt: new Date().toISOString(),
        metadata,
      }
    }),
  )

  function buildOperationSpec(): OperationSpec {
    const base = {
      prompt: prompt.value,
      seed: seed.value,
      numImages: numImages.value,
      responseFormat: 'base64' as const,
      ...(negativePrompt.value ? { negativePrompt: negativePrompt.value } : {}),
      ...(aspectRatio.value ? { aspectRatio: aspectRatio.value } : {}),
    }

    if (selectedOperation.value === 'edit') {
      const modelConstraints = activeModel.value?.constraints
      const canCustomSize = activeProvider.value?.capabilities.supportsCustomSize === true
        && modelConstraints?.supportsCustomSize !== false

      return {
        kind: 'edit',
        sourceArtifactId: selectedArtifact.value?.id ?? 'live-source',
        ...(canCustomSize || !modelConstraints?.supportedAspectRatios?.length
          ? { size: { width: width.value, height: height.value } }
          : {}),
        ...base,
      }
    }

    if (selectedOperation.value === 'upscale') {
      return {
        kind: 'upscale',
        sourceArtifactId: selectedArtifact.value?.id ?? 'live-source',
        size: { width: width.value, height: height.value },
        ...base,
      }
    }

    const modelConstraints = activeModel.value?.constraints
    const canCustomSize = activeProvider.value?.capabilities.supportsCustomSize === true
      && modelConstraints?.supportsCustomSize !== false

    return {
      kind: 'generate',
      ...(canCustomSize || !modelConstraints?.supportedAspectRatios?.length
        ? { size: { width: width.value, height: height.value } }
        : {}),
      ...base,
    }
  }

  function buildRunInput(): UnifiedRunInput {
    const trimmedApiKey = apiKey.value.trim()
    const savedKey = providerKeys.value[selectedProviderId.value] ?? ''

    return {
      providerId: selectedProviderId.value,
      modelId: selectedModelId.value,
      auth: trimmedApiKey ? { apiKey: trimmedApiKey } : (savedKey ? { apiKey: savedKey } : {}),
      operation: buildOperationSpec(),
      ...(selectedOperation.value === 'edit' && selectedSourceImageInput.value
        ? { imageInputs: selectedSourceImageInput.value }
        : {}),
      providerOptions: providerOptions.value,
    }
  }

  async function runPreparedExecution() {
    lastRunError.value = undefined
    lastRunMessage.value = undefined
    latestPlan.value = undefined

    try {
      isPreparingRun.value = true
      const plan = await prepareRun(buildRunInput())
      latestPlan.value = plan
      lastRunMessage.value = `Prepared ${plan.providerId}/${plan.modelId} run plan.`
    } catch (runError) {
      lastRunError.value = runError instanceof Error ? runError.message : 'Failed to prepare run'
      return
    } finally {
      isPreparingRun.value = false
    }

    if (!latestPlan.value) {
      return
    }

    try {
      isExecutingRun.value = true
      const trimmedApiKey = apiKey.value.trim()
      const savedKey = providerKeys.value[selectedProviderId.value] ?? ''
      const effectiveKey = trimmedApiKey || savedKey
      const result = await executePreparedRun(
        effectiveKey
          ? {
              planId: latestPlan.value.id,
              auth: {
                apiKey: effectiveKey,
              },
            }
          : {
              planId: latestPlan.value.id,
            },
      )

      liveOutputs.value = result.outputs
      lastRunMessage.value = `Received ${result.outputs.length} live output(s) from ${selectedProviderId.value}.`

      try {
        const fresh = await fetchBootstrap()
        bootstrap.value = fresh
        if (fresh.artifacts.length > 0) {
          selectedArtifactId.value = fresh.artifacts[0]?.id
        }
      } catch {
        /* ignore bootstrap refresh errors */
      }
    } catch (runError) {
      lastRunError.value = runError instanceof Error ? runError.message : 'Failed to execute run'
    } finally {
      isExecutingRun.value = false
    }
  }

  async function updateSourceImage(file: File) {
    const dataUrl = await fileToDataUrl(file)
    sourceImageDataUrl.value = dataUrl
    sourceImageFilename.value = file.name
  }

  function applyProviderDefaults() {
    if (!activeProvider.value || !selectedModelId.value) {
      providerOptions.value = {}
      return
    }

    providerOptions.value = normalizeProviderOptions(activeProvider.value, selectedModelId.value)
  }

  function syncSizeToModelConstraints() {
    const sizePresets = activeModel.value?.constraints?.sizePresets
    if (!sizePresets || sizePresets.length === 0) {
      return
    }

    const currentMatchesPreset = sizePresets.some((preset) => preset.width === width.value && preset.height === height.value)
    if (currentMatchesPreset) {
      return
    }

    const firstPreset = sizePresets[0]
    if (!firstPreset) {
      return
    }

    width.value = firstPreset.width
    height.value = firstPreset.height
  }

  watch(activeProvider, (provider) => {
    if (!provider) {
      return
    }

    if (!provider.models.some((model) => model.id === selectedModelId.value)) {
      selectedModelId.value = provider.defaultModelId
    }

    applyProviderDefaults()
    syncSizeToModelConstraints()
  })

  watch(selectedModelId, () => {
    applyProviderDefaults()
    syncSizeToModelConstraints()
  })

  let aspectRatioTimer: ReturnType<typeof setTimeout> | undefined
  const aspectRatioSizeMap: Record<string, { width: number; height: number }> = {
    '1:1': { width: 1024, height: 1024 },
    '16:9': { width: 1280, height: 720 },
    '4:3': { width: 1152, height: 864 },
    '3:2': { width: 1248, height: 832 },
    '2:3': { width: 832, height: 1248 },
    '3:4': { width: 864, height: 1152 },
    '9:16': { width: 720, height: 1280 },
    '21:9': { width: 1344, height: 576 },
  }

  watch([width, height], () => {
    if (aspectRatioTimer) clearTimeout(aspectRatioTimer)
    aspectRatioTimer = setTimeout(() => {
      aspectRatio.value = ratioLabel(width.value, height.value)
    }, 300)
  })

  watch(aspectRatio, (ratio) => {
    const size = aspectRatioSizeMap[ratio]
    if (size) {
      width.value = size.width
      height.value = size.height
    }
  })

  async function loadBootstrap() {
    isLoading.value = true

    try {
      const response = await fetchBootstrap()
      bootstrap.value = response
      selectedWorkspaceId.value = response.selectedWorkspaceId
      selectedLocale.value = response.workspaces[0]?.locale ?? selectedLocale.value
      selectedArtifactId.value = response.workspaces[0]?.uiState.selectedArtifactId
      selectedOperation.value = response.workspaces[0]?.uiState.activeOperation ?? selectedOperation.value
      selectedProviderId.value = response.workspaces[0]?.uiState.activeProviderId ?? selectedProviderId.value
      selectedModelId.value = response.workspaces[0]?.uiState.activeModelId ?? selectedModelId.value
      isUsingFallbackData.value = false
    } catch (loadError) {
      error.value = loadError instanceof Error ? loadError.message : 'Unknown bootstrap error'
      bootstrap.value = createDemoBootstrap()
      isUsingFallbackData.value = true
    } finally {
      isLoading.value = false
      applyProviderDefaults()
      syncSizeToModelConstraints()
      const folder = localStorage.getItem('imageall_workspace_folder')
      if (folder) {
        const ws = bootstrap.value.workspaces[0]
        if (ws) ws.name = folder.split('/').pop() ?? folder
      }
    }
  }

  void loadBootstrap()

  return {
    isLoading,
    isUsingFallbackData,
    error,
    bootstrap,
    locales,
    providers,
    registry,
    workspaces,
    workspace,
    artifacts,
    runs,
    activeProvider,
    activeModel,
    selectedArtifact,
    compareArtifacts,
    recentOutputArtifacts,
    currentProviderOptions,
    availableSizePresets,
    supportedAspectRatios,
    supportsCustomSize,
    supportsNegativePrompt,
    maxImages,
    selectedWorkspaceId,
    selectedArtifactId,
    selectedOperation,
    selectedProviderId,
    selectedModelId,
    selectedLocale,
    prompt,
    negativePrompt,
    aspectRatio,
    width,
    height,
    numImages,
    seed,
    providerOptions,
    providerKeys,
    apiKey,
    sourceImageDataUrl,
    sourceImageFilename,
    latestPlan,
    lastRunError,
    lastRunMessage,
    isPreparingRun,
    isExecutingRun,
    liveOutputs,
    liveOutputArtifacts,
    runPreparedExecution,
    updateSourceImage,
    updateProviderKeys: (keys: Record<string, string>) => {
      providerKeys.value = keys
    },
    setWorkspaceFolder: async (path: string) => {
      localStorage.setItem('imageall_workspace_folder', path)
      workspacePath.value = path

      const ws = bootstrap.value.workspaces[0]
      if (ws) ws.name = path.split('/').pop() ?? path

      try {
        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? ''
        const response = await fetch(`${apiBaseUrl}/api/workspace/folder`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path }),
        })
        const data = await response.json()

        if (data.ok && data.restored) {
          if (data.workspace) {
            const existingWs = bootstrap.value.workspaces[0]
            if (existingWs) {
              existingWs.id = data.workspace.id
              existingWs.name = data.workspace.name
              existingWs.locale = data.workspace.locale
              existingWs.uiState = data.workspace.uiState
            }
          }
          bootstrap.value.artifacts = data.artifacts ?? []
          bootstrap.value.runs = data.runs ?? []
          const artifactCount = data.artifacts?.length ?? 0
          const runCount = data.runs?.length ?? 0
          if (artifactCount > 0) {
            selectedArtifactId.value = data.artifacts[0]?.id
          }

          const warnings = data.warnings?.length ? ` (${data.warnings.length} warnings)` : ''
          restorationStatus.value = `Restored ${artifactCount} artifacts and ${runCount} runs from workspace${warnings}`
        } else if (data.ok) {
          bootstrap.value.artifacts = []
          bootstrap.value.runs = []
        }
      } catch (error) {
        restorationError.value = error instanceof Error ? error.message : 'Failed to set workspace folder'
      }
    },
    isRestoringWorkspace,
    restorationStatus,
    restorationError,
    workspacePath,
    attemptWorkspaceRestore,
  }

  async function attemptWorkspaceRestore(path: string) {
    isRestoringWorkspace.value = true
    restorationStatus.value = undefined
    restorationError.value = undefined

    try {
      const status = await checkWorkspaceStatus(path)
      if (status.exists) {
        const restored = await restoreWorkspace(path)

        bootstrap.value.artifacts = restored.artifacts
        bootstrap.value.runs = restored.runs

        if (restored.workspace) {
          const ws = bootstrap.value.workspaces[0]
          if (ws) {
            ws.id = restored.workspace.id
            ws.name = restored.workspace.name
            ws.locale = restored.workspace.locale
            ws.uiState = restored.workspace.uiState
          }
        }

        if (restored.artifacts.length > 0) {
          selectedArtifactId.value = restored.artifacts[0]?.id
        }

        const warnings = restored.warnings.length > 0 ? ` (${restored.warnings.length} warnings)` : ''
        restorationStatus.value = `Restored ${restored.artifacts.length} artifacts and ${restored.runs.length} runs from workspace${warnings}`
      } else {
        restorationStatus.value = 'No persisted data in this folder'
      }
    } catch (error) {
      restorationError.value = error instanceof Error ? error.message : 'Failed to restore workspace'
    } finally {
      isRestoringWorkspace.value = false
    }
  }
}

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }

      reject(new Error('Failed to read image file.'))
    }

    reader.onerror = () => {
      reject(new Error('Failed to read image file.'))
    }

    reader.readAsDataURL(file)
  })
}
