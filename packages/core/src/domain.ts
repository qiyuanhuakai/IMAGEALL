export type LocaleCode = 'en' | 'zh-CN'

export type OperationKind = 'generate' | 'edit' | 'image2image' | 'upscale'

export type RunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'

export type RunLogLevel = 'info' | 'warning' | 'error'

export type ProviderOptionControl = 'boolean' | 'number' | 'select' | 'text'

export type ResponseFormat = 'url' | 'base64'

export type ImageInputKind = 'url' | 'base64' | 'data-url'

export interface LocaleOption {
  code: LocaleCode
  label: string
}

export interface WorkspaceUiState {
  selectedArtifactId?: string
  compareArtifactIds: string[]
  activeOperation: OperationKind
  activeProviderId: string
  activeModelId: string
}

export interface Workspace {
  id: string
  name: string
  locale: LocaleCode
  createdAt: string
  updatedAt: string
  artifactIds: string[]
  runIds: string[]
  uiState: WorkspaceUiState
}

export interface Artifact {
  id: string
  workspaceId: string
  kind: 'input' | 'generated' | 'edited' | 'derived'
  title: string
  mimeType: string
  width: number
  height: number
  uri: string
  thumbnailUri?: string
  createdAt: string
  sourceRunId?: string
  parentArtifactId?: string
  metadata: {
    provider?: string
    model?: string
    seed?: number
    prompt?: string
    negativePrompt?: string
    extra?: Record<string, unknown>
  }
}

export interface OperationSpecBase {
  kind: OperationKind
  prompt?: string
  negativePrompt?: string
  size?: { width: number; height: number }
  aspectRatio?: string
  seed?: number
  numImages?: number
  responseFormat?: ResponseFormat
}

export interface GenerateOperationSpec extends OperationSpecBase {
  kind: 'generate'
}

export interface EditOperationSpec extends OperationSpecBase {
  kind: 'edit'
  sourceArtifactId: string
  maskArtifactId?: string
}

export interface Image2imageOperationSpec extends OperationSpecBase {
  kind: 'image2image'
  sourceArtifactId: string
  sourceWeight?: number
}

export interface UpscaleOperationSpec extends OperationSpecBase {
  kind: 'upscale'
  sourceArtifactId: string
  scale?: number
}

export type OperationSpec =
  | GenerateOperationSpec
  | EditOperationSpec
  | Image2imageOperationSpec
  | UpscaleOperationSpec

export interface RunLogEntry {
  timestamp: string
  level: RunLogLevel
  message: string
}

export interface Run {
  id: string
  workspaceId: string
  operation: OperationSpec
  providerId: string
  modelId: string
  providerSnapshot: {
    adaptorVersion: string
    resolvedParams: Record<string, unknown>
  }
  status: RunStatus
  createdAt: string
  startedAt?: string
  finishedAt?: string
  outputArtifactIds: string[]
  logs: RunLogEntry[]
  error?: {
    code?: string
    message: string
    raw?: unknown
  }
}

export interface ProviderOptionDefinition {
  id: string
  label: string
  description: string
  control: ProviderOptionControl
  defaultValue: string | number | boolean
  min?: number
  max?: number
  step?: number
  options?: Array<{
    value: string
    label: string
  }>
  appliesToModels?: string[]
  appliesToOperations?: OperationKind[]
}

export interface ProviderModelManifest {
  id: string
  label: string
  operations: OperationKind[]
  constraints?: {
    maxImages?: number
    promptMaxLength?: number
    supportedAspectRatios?: string[]
    sizePresets?: Array<{ width: number; height: number }>
    supportsCustomSize?: boolean
  }
  featureFlags?: {
    negativePrompt?: boolean
    styleReference?: boolean
    textMode?: boolean
    watermark?: boolean
    promptOptimizer?: boolean
  }
}

export interface ProviderManifest {
  id: string
  label: string
  description: string
  version: string
  accent: string
  auth: {
    type: 'apiKey'
    header: string
    envKey: string
  }
  operations: OperationKind[]
  capabilities: {
    supportsGenerate: boolean
    supportsEdit: boolean
    supportsImage2image?: boolean
    supportsUpscale?: boolean
    supportsMultiImage?: boolean
    supportsNegativePrompt?: boolean
    supportsCustomSize?: boolean
    supportsAspectRatio?: boolean
    supportsSeed?: boolean
    supportsBase64Output?: boolean
  }
  defaultModelId: string
  providerOptions: ProviderOptionDefinition[]
  models: ProviderModelManifest[]
}

export interface ValidationResult {
  ok: boolean
  errors: string[]
}

export interface ImageInputSource {
  kind: ImageInputKind
  value: string
  mimeType?: string
  filename?: string
}

export interface ProviderRequest {
  url: string
  method: 'POST'
  bodyType: 'json' | 'form-data'
  headers?: Record<string, string>
  body: Record<string, unknown> | FormData
}

export interface ProviderRequestPreview {
  url: string
  method: 'POST'
  bodyType: 'json' | 'form-data'
  headers?: Record<string, string>
  bodySummary: unknown
}

export interface UnifiedRunInput {
  operation: OperationSpec
  providerId: string
  modelId: string
  auth: {
    /** Plaintext API key (legacy, still supported) */
    apiKey?: string
    /** Reference to server-side stored key (preferred) */
    keyRef?: string
  }
  imageInputs?: ImageInputSource[]
  providerOptions?: Record<string, unknown>
}

export interface UnifiedRunResult {
  outputs: Array<{
    uri?: string
    base64?: string
    mimeType?: string
    width?: number
    height?: number
    seed?: number
  }>
  raw?: unknown
}

export interface PreparedRunPlan {
  id: string
  providerId: string
  modelId: string
  operationKind: OperationKind
  createdAt: string
  expiresAt: string
  requestPreview: ProviderRequestPreview
}

export interface ExecutePreparedRunInput {
  planId: string
  auth?: {
    /** Plaintext API key (legacy, still supported) */
    apiKey?: string
    /** Reference to server-side stored key (preferred) */
    keyRef?: string
  }
}

export interface KeyReference {
  keyRef: string
  providerId: string
  label?: string
  createdAt: string
  lastUsedAt?: string
}

export interface NormalizedProviderError {
  code?: string
  status?: number
  message: string
  raw?: unknown
}

export interface ImageProviderAdaptor {
  manifest: ProviderManifest
  validateOperation(input: UnifiedRunInput): ValidationResult
  buildRequest(input: UnifiedRunInput): Promise<ProviderRequest>
  execute(input: UnifiedRunInput): Promise<UnifiedRunResult>
  normalizeError(error: unknown): NormalizedProviderError
  getDynamicModelCapabilities?(): Promise<ProviderModelManifest[]>
}

export interface WorkbenchBootstrap {
  generatedAt: string
  locales: LocaleOption[]
  providers: ProviderManifest[]
  workspaces: Workspace[]
  artifacts: Artifact[]
  runs: Run[]
  selectedWorkspaceId: string
}

export interface WorkspaceStatus {
  exists: boolean
  artifactCount: number
  runCount: number
  lastModified?: string
  workspaceId?: string
}

export interface RestoredWorkspace {
  workspace: Workspace
  artifacts: Artifact[]
  runs: Run[]
  restoredAt: string
  warnings: string[]
}

export interface WorkspaceMetadata {
  id: string
  name: string
  locale: LocaleCode
  createdAt: string
  updatedAt: string
  selectedArtifactId?: string
  compareArtifactIds: string[]
  activeOperation: OperationKind
  activeProviderId: string
  activeModelId: string
}
