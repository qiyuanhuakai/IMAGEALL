import type {
  ImageInputSource,
  NormalizedProviderError,
  ProviderManifest,
  ProviderModelManifest,
  UnifiedRunInput,
  ValidationResult,
} from '../domain'

export function ok(): ValidationResult {
  return { ok: true, errors: [] }
}

export function fail(...errors: string[]): ValidationResult {
  return { ok: false, errors }
}

export function findProviderModel(provider: ProviderManifest, modelId: string): ProviderModelManifest | undefined {
  return provider.models.find((model) => model.id === modelId)
}

export function requirePrompt(input: UnifiedRunInput): string | undefined {
  const prompt = input.operation.prompt?.trim()
  return prompt && prompt.length > 0 ? prompt : undefined
}

export function requireImageInput(input: UnifiedRunInput): ImageInputSource | undefined {
  return input.imageInputs?.[0]
}

export function isDataUrl(value: string): boolean {
  return value.startsWith('data:')
}

export function isHttpUrl(value: string): boolean {
  return /^https?:\/\//.test(value)
}

export function createBearerHeaders(apiKey: string, extraHeaders?: Record<string, string>): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    ...extraHeaders,
  }
}

export function createAuthOnlyHeaders(apiKey: string, extraHeaders?: Record<string, string>): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    ...extraHeaders,
  }
}

export function normalizeUnknownError(error: unknown, fallbackMessage: string): NormalizedProviderError {
  if (error instanceof Error) {
    return {
      message: error.message,
      raw: error,
    }
  }

  return {
    message: fallbackMessage,
    raw: error,
  }
}

export function assertApiKey(input: UnifiedRunInput, providerLabel: string): string | undefined {
  const apiKey = input.auth.apiKey?.trim()
  if (!apiKey) {
    return `${providerLabel} API key is required.`
  }

  return undefined
}

export function parseDataUrl(value: string): { mimeType: string; base64: string } | undefined {
  const match = /^data:(.+);base64,(.+)$/u.exec(value)

  if (!match) {
    return undefined
  }

  const mimeType = match[1]
  const base64 = match[2]

  if (!mimeType || !base64) {
    return undefined
  }

  return {
    mimeType,
    base64,
  }
}

export function requireProviderManifest(providerId: string, manifests: ProviderManifest[]): ProviderManifest {
  const manifest = manifests.find((provider) => provider.id === providerId)

  if (!manifest) {
    throw new Error(`Provider manifest is missing: ${providerId}`)
  }

  return manifest
}

export function imageInputToDataUrl(input: ImageInputSource): string | undefined {
  if (input.kind === 'data-url') {
    return input.value
  }

  if (input.kind === 'base64') {
    const mimeType = input.mimeType ?? 'image/png'
    return `data:${mimeType};base64,${input.value}`
  }

  return undefined
}

export function imageInputToBlob(input: ImageInputSource): Blob | undefined {
  if (input.kind === 'data-url') {
    const parsed = parseDataUrl(input.value)
    if (!parsed) {
      return undefined
    }

    return new Blob([decodeBase64(parsed.base64)], {
      type: parsed.mimeType,
    })
  }

  if (input.kind === 'base64') {
    return new Blob([decodeBase64(input.value)], {
      type: input.mimeType ?? 'image/png',
    })
  }

  return undefined
}

function decodeBase64(value: string): ArrayBuffer {
  const normalized = atob(value)
  const bytes = new Uint8Array(normalized.length)

  for (let index = 0; index < normalized.length; index += 1) {
    bytes[index] = normalized.charCodeAt(index)
  }

  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}
