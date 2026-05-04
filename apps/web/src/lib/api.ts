import type {
  ExecutePreparedRunInput,
  NormalizedProviderError,
  PreparedRunPlan,
  RestoredWorkspace,
  UnifiedRunInput,
  UnifiedRunResult,
  WorkbenchBootstrap,
  WorkspaceStatus,
} from '@imageall/core'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export function resolveArtifactUri(uri: string): string {
  if (uri.startsWith('__serve__:')) {
    const relativePath = uri.slice('__serve__:'.length)
    return `${API_BASE_URL}/api/serve/${relativePath}`
  }
  if (uri.startsWith('/api/serve/')) {
    return uri
  }
  return uri
}

export async function fetchBootstrap(): Promise<WorkbenchBootstrap> {
  const response = await fetch(`${API_BASE_URL}/api/bootstrap`)

  if (!response.ok) {
    throw new Error(`Failed to load bootstrap: ${response.status}`)
  }

  return (await response.json()) as WorkbenchBootstrap
}

interface PrepareRunResponse {
  ok: boolean
  plan?: PreparedRunPlan
  error?: NormalizedProviderError
  message?: string
}

interface ExecuteRunResponse {
  ok: boolean
  result?: UnifiedRunResult
  error?: NormalizedProviderError
  message?: string
}

async function readJsonOrThrow<T>(response: Response, fallbackMessage: string): Promise<T> {
  const payload = (await response.json()) as T

  if (!response.ok) {
    if (payload && typeof payload === 'object') {
      const maybeMessage = (payload as { message?: string; error?: { message?: string } }).error?.message
        ?? (payload as { message?: string }).message

      if (maybeMessage) {
        throw new Error(maybeMessage)
      }
    }

    throw new Error(fallbackMessage)
  }

  return payload
}

export async function prepareRun(input: UnifiedRunInput): Promise<PreparedRunPlan> {
  const response = await fetch(`${API_BASE_URL}/api/runs/prepare`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })

  const payload = await readJsonOrThrow<PrepareRunResponse>(response, `Failed to prepare run: ${response.status}`)

  if (!payload.ok || !payload.plan) {
    throw new Error(payload.error?.message ?? payload.message ?? 'Failed to prepare run.')
  }

  return payload.plan
}

export async function executePreparedRun(input: ExecutePreparedRunInput): Promise<UnifiedRunResult> {
  const response = await fetch(`${API_BASE_URL}/api/runs/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })

  const payload = await readJsonOrThrow<ExecuteRunResponse>(response, `Failed to execute run: ${response.status}`)

  if (!payload.ok || !payload.result) {
    throw new Error(payload.error?.message ?? payload.message ?? 'Failed to execute prepared run.')
  }

   return payload.result
}

export async function checkWorkspaceStatus(path: string): Promise<WorkspaceStatus> {
  const response = await fetch(`${API_BASE_URL}/api/workspace/status?path=${encodeURIComponent(path)}`)

  return readJsonOrThrow<WorkspaceStatus>(response, `Failed to check workspace status: ${response.status}`)
}

export async function restoreWorkspace(path: string): Promise<RestoredWorkspace> {
  const response = await fetch(`${API_BASE_URL}/api/workspace/restore?path=${encodeURIComponent(path)}`)

  return readJsonOrThrow<RestoredWorkspace>(response, `Failed to restore workspace: ${response.status}`)
}
