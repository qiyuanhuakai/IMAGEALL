# ImageAll Architecture

This document defines the first-release architecture for ImageAll.

It exists to make implementation easier to reason about and harder to accidentally derail.

The architecture is shaped by one product claim:

> ImageAll is a multilingual image workbench for generating, editing, and comparing images across providers without flattening their differences.

## 1. Architectural stance

ImageAll v1 should be:

- **browser-first**
- **single-shell**
- **artifact-oriented**
- **run-oriented**
- **provider-aware but provider-owned nowhere**
- **localized from the start**

It should **not** be:

- a node graph
- a plugin marketplace
- a lowest-common-denominator provider wrapper
- a set of provider-specific pages

## 2. Core invariants

These invariants should remain true unless the product thesis changes.

### 2.1 Artifacts are immutable

Every generation or edit produces a new artifact.

We do not silently mutate existing image records.

### 2.2 Runs are append-only

A run is a factual execution record.

Once recorded, it should not be rewritten to hide errors, filtered results, or provider behavior.

### 2.3 UI state is not domain state

Selection, expanded panels, compare mode, and temporary form state belong to the UI layer.

They are not first-class domain objects.

### 2.4 Core stays provider-light

Provider and model references appear in runs and manifests, but they do not become the center of the domain.

The domain is about work, artifacts, and execution history.

### 2.5 Adaptors do not own the shell

Adaptors may define validation, schemas, and provider-specific options.

They may not replace the app's top-level information architecture.

## 3. First-release domain model

The core is intentionally small.

### 3.1 Workspace

The persistent container for image work.

```ts
type WorkspaceId = string

interface Workspace {
  id: WorkspaceId
  name: string
  locale: string
  createdAt: string
  updatedAt: string

  artifactIds: string[]
  runIds: string[]

  uiState?: WorkspaceUiState
}
```

`Workspace` owns the local context for artifacts and runs.

It should remain lightweight.

### 3.2 Artifact

The immutable image asset unit.

```ts
type ArtifactId = string

interface Artifact {
  id: ArtifactId
  workspaceId: WorkspaceId

  kind: 'input' | 'generated' | 'edited' | 'derived'
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
```

Artifacts are what make comparison, export, and lineage possible.

### 3.3 OperationSpec

The typed user intention.

This is not the raw request body of a provider.

```ts
type OperationKind = 'generate' | 'edit' | 'upscale'

interface OperationSpecBase {
  kind: OperationKind
  prompt?: string
  negativePrompt?: string
  size?: { width: number; height: number }
  aspectRatio?: string
  seed?: number
  numImages?: number
  responseFormat?: 'url' | 'base64'
}

interface GenerateOperationSpec extends OperationSpecBase {
  kind: 'generate'
}

interface EditOperationSpec extends OperationSpecBase {
  kind: 'edit'
  sourceArtifactId: ArtifactId
  maskArtifactId?: ArtifactId
}

interface UpscaleOperationSpec extends OperationSpecBase {
  kind: 'upscale'
  sourceArtifactId: ArtifactId
  scale?: number
}
```

The operation layer exists so the UI and the provider layer do not collapse into each other.

### 3.4 Run

A run is one execution of one operation against one provider and model snapshot.

```ts
type RunId = string
type RunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'

interface Run {
  id: RunId
  workspaceId: WorkspaceId

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
  logs?: RunLogEntry[]
  error?: {
    code?: string
    message: string
    raw?: unknown
  }
}
```

Runs support:

- provenance
- reproducibility
- failure visibility
- compare history

## 4. Deliberately excluded first-class objects

Do **not** promote these to domain center in v1:

- global model catalog
- third-party plugin package entity
- custom provider screen entity
- workflow graph entity
- multi-user collaboration entity

Those may appear later, but introducing them early would distort the product.

## 5. Adaptor architecture

## 5.1 v1 rule: in-tree adaptors only

The first release should support **modular in-tree adaptors**, not a full external plugin ABI.

That means:

- adaptors are isolated modules
- adaptors expose stable manifests and contracts
- adaptors can evolve inside the repository with the host
- versioned external extension support is postponed

This keeps the host contract honest while the product is still finding its shape.

## 5.2 Provider manifest

```ts
interface ProviderManifest {
  id: string
  label: string
  version: string

  auth: {
    type: 'apiKey'
    header?: string
    envKey?: string
  }

  operations: OperationKind[]

  capabilities: {
    supportsGenerate: boolean
    supportsEdit: boolean
    supportsUpscale?: boolean
    supportsMultiImage?: boolean
    supportsNegativePrompt?: boolean
    supportsCustomSize?: boolean
    supportsAspectRatio?: boolean
    supportsSeed?: boolean
    supportsBase64Output?: boolean
  }

  models: ProviderModelManifest[]
}
```

## 5.3 Provider model manifest

```ts
interface ProviderModelManifest {
  id: string
  label: string

  operations: OperationKind[]

  constraints?: {
    maxImages?: number
    promptMaxLength?: number
    supportedAspectRatios?: string[]
    sizePresets?: Array<{ width: number; height: number }>
  }

  featureFlags?: {
    negativePrompt?: boolean
    styleReference?: boolean
    textMode?: boolean
    watermark?: boolean
    promptOptimizer?: boolean
  }
}
```

This allows the host to drive the inspector without pretending the providers are uniform.

## 5.4 Adaptor contract

```ts
interface UnifiedRunInput {
  operation: OperationSpec
  providerId: string
  modelId: string

  auth: {
    apiKey?: string
  }

  providerOptions?: Record<string, unknown>
}

interface UnifiedRunResult {
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

interface ImageProviderAdaptor {
  manifest: ProviderManifest

  validateOperation(input: UnifiedRunInput): ValidationResult
  buildRequest(input: UnifiedRunInput): Promise<ProviderRequest>
  execute(input: UnifiedRunInput): Promise<UnifiedRunResult>
  normalizeError(error: unknown): NormalizedProviderError
  getDynamicModelCapabilities?(): Promise<ProviderModelManifest[]>
}
```

## 5.5 Core fields vs provider options

This separation is critical.

### Core fields

Only stable cross-provider ideas belong in the core operation model:

- prompt
- negative prompt
- source image
- optional mask
- size
- aspect ratio
- num images
- seed
- response format

`steps` and `guidanceScale` may be included only if they remain meaningfully consistent enough across supported adaptors.

### Provider options

Everything adaptor-specific belongs in `providerOptions`.

Examples:

- StepFun `text_mode`
- StepFun `style_reference`
- MiniMax `prompt_optimizer`
- MiniMax `aigc_watermark`
- MiniMax `style`

The UI should present these clearly as provider-specific, not as fake universal parameters.

## 6. UI information architecture

ImageAll should use a **single workbench shell**.

No provider should receive its own top-level navigation surface.

### 6.1 Shell sketch

```text
┌──────────────────────────────────────────────────────────────┐
│ Top Bar                                                     │
│ Logo / Workspace / Provider / Model / Locale / Settings     │
├───────────────┬───────────────────────────────┬─────────────┤
│ Left Panel    │ Center Stage                  │ Right Panel │
│               │                               │             │
│ - Library     │ - Canvas / Preview            │ - Inspector │
│ - History     │ - Result Grid                 │ - Operation │
│ - Runs        │ - Compare Mode                │ - Params    │
│ - Collections │ - Empty / Loading States      │ - Provider  │
│               │                               │   Options   │
├───────────────┴───────────────────────────────┴─────────────┤
│ Bottom Tray                                                  │
│ Run Queue / Progress / Logs / Output Strip                   │
└──────────────────────────────────────────────────────────────┘
```

### 6.2 Left panel

Owns the project's memory:

- artifact library
- run history
- collections or saved groups
- filters by provider, model, operation kind, or time

### 6.3 Center stage

Owns the visual focus of the product.

Primary states:

1. **single preview**
2. **result grid**
3. **compare mode**

This area must feel image-first, not form-first.

### 6.4 Right inspector

Owns the workflow controls:

1. operation selection
2. common parameters
3. provider-specific parameters
4. run actions

Provider-specific options should sit in an explicitly labeled section.

### 6.5 Bottom tray

Owns execution awareness:

- queue state
- progress
- lightweight logs
- recent outputs

## 7. Visual system direction

The visual system should borrow from the serious, layered, dense workspace language already proven in `opencode-visualizer-cn`, while adapting it for image-first work.

Recommended traits:

- dark layered surfaces
- restrained translucency
- strong typography
- accent-coded panel identity
- floating support panels and dock patterns
- compact, serious control density

Required adaptation:

- replace text-stream centrality with image-stage centrality
- replace chat input dominance with inspector-driven flow
- keep provider-specific controls visually secondary to the core workbench flow

## 8. Initial adaptor set

### 8.1 MiniMaxAdaptor

Use MiniMax as a reference implementation for a clean host-to-provider flow.

Planned support:

- generate
- edit

### 8.2 StepFunAdaptor

Use StepFun as the architecture stress test.

Planned support:

- generate
- edit

StepFun forces the system to handle:

- endpoint differences
- request serialization differences
- provider-specific feature flags
- model-specific capability divergence

## 9. Suggested source layout

```text
src/
  app/
    shell/
    layout/
    routes/
  core/
    workspace/
    artifact/
    operation/
    run/
  providers/
    manifests/
    adapters/
      minimax/
      stepfun/
    registry/
  features/
    library/
    preview/
    compare/
    inspector/
    history/
    queue/
  ui/
    components/
    tokens/
    themes/
  i18n/
    locales/
    messages/
  lib/
    http/
    storage/
    schema/
    utils/
```

This structure keeps product layers visible:

- `core` for the domain
- `providers` for adaptor implementations
- `features` for workflow surfaces
- `ui` for reusable shell components and theme tokens

## 10. First-release scope

### In scope

- browser-first workbench shell
- localization infrastructure
- MiniMax and StepFun in-tree adaptors
- generate / edit / upscale core operations
- artifact library
- run history
- compare flow
- export flow

### Out of scope

- third-party adaptor ABI
- node graph workflows
- provider-injected pages
- collaboration and cloud accounts
- marketplace systems
- video-first workflows

## 11. Open questions

These should be resolved during early implementation, not before it:

1. Should `steps` and `guidanceScale` live in the core spec or stay provider-scoped at first?
2. Should workspaces persist to a local database, files on disk, or both?
3. How much floating-window behavior from the visual inspiration should be retained in the v1 shell?
4. When should upscale become first-class instead of an adaptor-specific advanced action?

## 12. Summary

The first release architecture should stay small, explicit, and difficult to misuse.

The most important thing to preserve is this split:

- **core owns workflow and provenance**
- **adaptors own translation to providers**
- **the shell owns the experience**

If those three lines stay clear, the project can grow without losing its identity.
