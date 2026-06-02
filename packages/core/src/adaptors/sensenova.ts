import type {
  ImageProviderAdaptor,
  NormalizedProviderError,
  ProviderRequest,
  UnifiedRunInput,
  UnifiedRunResult,
  ValidationResult,
} from '../domain'
import { providerManifests } from '../providers'
import {
  assertApiKey,
  createBearerHeaders,
  fail,
  findProviderModel,
  normalizeUnknownError,
  ok,
  requireProviderManifest,
  requirePrompt,
} from './helpers'

const sensenovaManifest = requireProviderManifest('sensenova', providerManifests)

const SENSENOVA_BASE_URL = 'https://token.sensenova.cn'

const SENSENOVA_SIZE_PRESETS: Array<{ width: number; height: number }> = [
  { width: 1664, height: 2496 },
  { width: 2496, height: 1664 },
  { width: 1760, height: 2368 },
  { width: 2368, height: 1760 },
  { width: 1824, height: 2272 },
  { width: 2272, height: 1824 },
  { width: 2048, height: 2048 },
  { width: 2752, height: 1536 },
  { width: 1536, height: 2752 },
  { width: 3072, height: 1376 },
  { width: 1344, height: 3136 },
]

function findSizePreset(size: { width: number; height: number }): { width: number; height: number } | undefined {
  return SENSENOVA_SIZE_PRESETS.find(
    (preset) => preset.width === size.width && preset.height === size.height,
  )
}

export class SenseNovaAdaptor implements ImageProviderAdaptor {
  manifest: ImageProviderAdaptor['manifest'] = sensenovaManifest

  validateOperation(input: UnifiedRunInput): ValidationResult {
    const model = findProviderModel(this.manifest, input.modelId)
    const errors: string[] = []

    const apiKeyError = assertApiKey(input, this.manifest.label)
    if (apiKeyError) {
      errors.push(apiKeyError)
    }

    if (!model) {
      errors.push(`Unsupported SenseNova model: ${input.modelId}`)
      return fail(...errors)
    }

    if (!model.operations.includes(input.operation.kind)) {
      errors.push(`Model ${model.id} does not support ${input.operation.kind}.`)
    }

    if (input.operation.kind !== 'generate') {
      errors.push('SenseNova U1 Fast only supports generate operations.')
    }

    const prompt = requirePrompt(input)
    if (!prompt) {
      errors.push('SenseNova requires a non-empty prompt.')
    }

    if (prompt && prompt.length > 4096) {
      errors.push('SenseNova prompts must be 4096 characters or fewer.')
    }

    if (input.operation.numImages !== undefined && (input.operation.numImages < 1 || input.operation.numImages > 1)) {
      errors.push('SenseNova U1 Fast only supports generating 1 image per request.')
    }

    if (input.operation.size) {
      const preset = findSizePreset(input.operation.size)
      if (!preset) {
        errors.push(
          'SenseNova U1 Fast only supports predefined 2K size presets: ' +
            SENSENOVA_SIZE_PRESETS.map((p) => `${p.width}x${p.height}`).join(', '),
        )
      }
    }

    return errors.length > 0 ? fail(...errors) : ok()
  }

  async buildRequest(input: UnifiedRunInput): Promise<ProviderRequest> {
    const validation = this.validateOperation(input)
    if (!validation.ok) {
      throw new Error(validation.errors.join(' '))
    }

    const apiKey = input.auth.apiKey?.trim()
    if (!apiKey) {
      throw new Error('SenseNova API key is missing.')
    }

    const prompt = requirePrompt(input)
    if (!prompt) {
      throw new Error('SenseNova prompt is required.')
    }

    const body: Record<string, unknown> = {
      model: input.modelId,
      prompt,
    }

    if (input.operation.size) {
      const preset = findSizePreset(input.operation.size)
      if (preset) {
        body.size = `${preset.width}x${preset.height}`
      }
    }

    if (input.operation.numImages !== undefined) {
      body.n = input.operation.numImages
    }

    return {
      url: `${SENSENOVA_BASE_URL}/v1/images/generations`,
      method: 'POST',
      bodyType: 'json',
      headers: createBearerHeaders(apiKey),
      body,
    }
  }

  async execute(input: UnifiedRunInput): Promise<UnifiedRunResult> {
    const request = await this.buildRequest(input)
    let response: Response

    try {
      response = await fetch(request.url, {
        method: request.method,
        ...(request.headers ? { headers: request.headers } : {}),
        body: JSON.stringify(request.body),
      })
    } catch (networkError) {
      throw this.normalizeError({ response: undefined, payload: undefined, networkError })
    }

    const contentType = response.headers.get('content-type') ?? ''
    let payload: {
      created?: number
      data?: Array<{ url?: string }>
      error?: {
        code?: string
        message?: string
      }
    } | undefined

    if (contentType.includes('application/json')) {
      try {
        payload = (await response.json()) as typeof payload
      } catch {
        // Non-JSON or malformed response — error will be reported from response status below
      }
    }

    if (!response.ok || payload?.error) {
      throw this.normalizeError({ response, payload })
    }

    const outputs = (payload?.data ?? [])
      .filter((item) => item.url)
      .map((item) => ({
        uri: item.url!,
      }))

    return {
      outputs,
      raw: payload,
    }
  }

  normalizeError(error: unknown): NormalizedProviderError {
    if (typeof error === 'object' && error !== null && 'payload' in error) {
      const err = error as {
        payload?: {
          error?: { code?: string; message?: string }
        }
        response?: Response
        networkError?: unknown
      }

      if (err.networkError) {
        const msg = err.networkError instanceof Error ? err.networkError.message : 'Network error'
        return { code: 'NETWORK_ERROR', message: `SenseNova network error: ${msg}`, raw: error }
      }

      const httpStatus = err.response?.status
      const errorCode = err.payload?.error?.code
      const errorMessage = err.payload?.error?.message

      const result: { code?: string; status?: number; message: string; raw?: unknown } = {
        message: errorMessage ?? (httpStatus ? `SenseNova request failed (HTTP ${httpStatus})` : 'SenseNova request failed.'),
        raw: error,
      }

      if (errorCode) {
        result.code = errorCode
      } else if (httpStatus !== undefined) {
        result.code = `HTTP_${httpStatus}`
      }

      if (httpStatus !== undefined) {
        result.status = httpStatus
      }

      return result
    }

    return normalizeUnknownError(error, 'SenseNova request failed.')
  }
}

export const sensenovaAdaptor = new SenseNovaAdaptor()
