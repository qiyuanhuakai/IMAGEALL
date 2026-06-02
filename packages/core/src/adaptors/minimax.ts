import type {
  ImageProviderAdaptor,
  ImageInputSource,
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
  imageInputToDataUrl,
  isDataUrl,
  isHttpUrl,
  normalizeUnknownError,
  ok,
  requireProviderManifest,
  requireImageInput,
  requirePrompt,
} from './helpers'

const minimaxManifest = requireProviderManifest('minimax', providerManifests)

const MINIMAX_BASE_URL = 'https://api.minimaxi.com'
const MINIMAX_IMAGE_01_ASPECT_RATIOS = ['1:1', '16:9', '4:3', '3:2', '2:3', '3:4', '9:16', '21:9']
const MINIMAX_IMAGE_01_LIVE_ASPECT_RATIOS = ['1:1', '16:9', '4:3', '3:2', '2:3', '3:4', '9:16']
const MINIMAX_ALLOWED_STYLE_TYPES = ['漫画', '元气', '中世纪', '水彩']

function getMiniMaxAllowedAspectRatios(modelId: string): string[] {
  return modelId === 'image-01-live' ? MINIMAX_IMAGE_01_LIVE_ASPECT_RATIOS : MINIMAX_IMAGE_01_ASPECT_RATIOS
}

function isValidMiniMaxImageInput(input: ImageInputSource): boolean {
  if (input.kind === 'url') {
    return isHttpUrl(input.value)
  }

  if (input.kind === 'data-url') {
    return isDataUrl(input.value)
  }

  return input.kind === 'base64'
}

function resolveMiniMaxImageInput(input: ImageInputSource): string | undefined {
  if (input.kind === 'url') {
    return input.value
  }

  return imageInputToDataUrl(input)
}

function getMiniMaxBaseUrl(input: UnifiedRunInput): string {
  const baseUrl = input.providerOptions?.baseUrl
  return typeof baseUrl === 'string' && baseUrl.trim().length > 0 ? baseUrl.trim() : MINIMAX_BASE_URL
}

export class MiniMaxAdaptor implements ImageProviderAdaptor {
  manifest: ImageProviderAdaptor['manifest'] = minimaxManifest

  validateOperation(input: UnifiedRunInput): ValidationResult {
    const model = findProviderModel(this.manifest, input.modelId)
    const errors: string[] = []

    const apiKeyError = assertApiKey(input, this.manifest.label)
    if (apiKeyError) {
      errors.push(apiKeyError)
    }

    if (!model) {
      errors.push(`Unsupported MiniMax model: ${input.modelId}`)
      return fail(...errors)
    }

    if (!model.operations.includes(input.operation.kind)) {
      errors.push(`Model ${model.id} does not support ${input.operation.kind}.`)
    }

    const prompt = requirePrompt(input)
    if (!prompt) {
      errors.push('MiniMax requires a non-empty prompt.')
    }

    if (prompt && prompt.length > 1500) {
      errors.push('MiniMax prompts must be 1500 characters or fewer.')
    }

    if (input.operation.aspectRatio && !getMiniMaxAllowedAspectRatios(input.modelId).includes(input.operation.aspectRatio)) {
      errors.push(`Unsupported MiniMax aspect ratio for ${input.modelId}: ${input.operation.aspectRatio}`)
    }

    if (input.operation.numImages && (input.operation.numImages < 1 || input.operation.numImages > 9)) {
      errors.push('MiniMax only supports between 1 and 9 images per request.')
    }

    if (input.operation.responseFormat && !['url', 'base64'].includes(input.operation.responseFormat)) {
      errors.push(`Unsupported MiniMax response format: ${input.operation.responseFormat}`)
    }

    if (input.operation.size) {
      const { width, height } = input.operation.size

      if (model.id !== 'image-01') {
        errors.push('MiniMax custom width/height is only documented for image-01.')
      }

      if (width < 512 || width > 2048 || width % 8 !== 0) {
        errors.push('MiniMax width must be between 512 and 2048 and divisible by 8.')
      }

      if (height < 512 || height > 2048 || height % 8 !== 0) {
        errors.push('MiniMax height must be between 512 and 2048 and divisible by 8.')
      }
    }

    const promptOptimizer = input.providerOptions?.promptOptimizer
    if (promptOptimizer !== undefined && typeof promptOptimizer !== 'boolean') {
      errors.push('MiniMax promptOptimizer must be a boolean when provided.')
    }

    const aigcWatermark = input.providerOptions?.aigcWatermark
    if (aigcWatermark !== undefined && typeof aigcWatermark !== 'boolean') {
      errors.push('MiniMax aigcWatermark must be a boolean when provided.')
    }

    const styleType = input.providerOptions?.styleType
    if (styleType !== undefined) {
      if (input.modelId !== 'image-01-live') {
        errors.push('MiniMax styleType is only supported for image-01-live.')
      } else if (typeof styleType !== 'string' || !MINIMAX_ALLOWED_STYLE_TYPES.includes(styleType)) {
        errors.push(`MiniMax styleType must be one of: ${MINIMAX_ALLOWED_STYLE_TYPES.join(', ')}.`)
      }
    }

    const styleWeight = input.providerOptions?.styleWeight
    if (styleWeight !== undefined) {
      if (input.modelId !== 'image-01-live') {
        errors.push('MiniMax styleWeight is only supported for image-01-live.')
      } else if (typeof styleWeight !== 'number' || styleWeight <= 0 || styleWeight > 1) {
        errors.push('MiniMax styleWeight must be a number in (0, 1].')
      }
    }

    if (input.operation.kind === 'edit') {
      const imageInput = requireImageInput(input)

      if (!imageInput) {
        errors.push('MiniMax edit mode requires a source image.')
      } else if (!isValidMiniMaxImageInput(imageInput)) {
        errors.push('MiniMax edit source must be a public URL or a base64 data URL.')
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
      throw new Error('MiniMax API key is missing.')
    }

    const prompt = requirePrompt(input)
    if (!prompt) {
      throw new Error('MiniMax prompt is required.')
    }

    const body: Record<string, unknown> = {
      model: input.modelId,
      prompt,
      response_format: input.operation.responseFormat ?? 'url',
      prompt_optimizer: Boolean(input.providerOptions?.promptOptimizer),
      aigc_watermark: Boolean(input.providerOptions?.aigcWatermark),
    }

    if (input.operation.aspectRatio) {
      body.aspect_ratio = input.operation.aspectRatio
    }

    if (input.operation.size && input.modelId === 'image-01') {
      body.width = input.operation.size.width
      body.height = input.operation.size.height
    }

    if (input.operation.seed !== undefined) {
      body.seed = input.operation.seed
    }

    if (input.operation.numImages !== undefined) {
      body.n = input.operation.numImages
    }

    if (input.modelId === 'image-01-live' && input.providerOptions?.styleType) {
      body.style = {
        style_type: input.providerOptions.styleType,
        style_weight: input.providerOptions?.styleWeight ?? 0.8,
      }
    }

    if (input.operation.kind === 'edit') {
      const imageInput = requireImageInput(input)
      if (!imageInput) {
        throw new Error('MiniMax edit mode requires an image input.')
      }

      const imageFile = resolveMiniMaxImageInput(imageInput)
      if (!imageFile) {
        throw new Error('MiniMax edit source could not be serialized.')
      }

      body.subject_reference = [
        {
          type: 'character',
          image_file: imageFile,
        },
      ]
    }

    return {
      url: `${getMiniMaxBaseUrl(input)}/v1/image_generation`,
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
      id?: string
      data?: {
        image_urls?: string[]
        image_base64?: string[]
      }
      metadata?: {
        success_count?: number
        failed_count?: number
      }
      base_resp?: {
        status_code?: number
        status_msg?: string
      }
    } | undefined

    if (contentType.includes('application/json')) {
      try {
        payload = (await response.json()) as typeof payload
      } catch {
        // Non-JSON or malformed response — error will be reported from response status below
      }
    }

    if (!response.ok || (payload?.base_resp?.status_code !== undefined && payload.base_resp.status_code !== 0)) {
      throw this.normalizeError({ response, payload })
    }

    const successCount = payload?.metadata?.success_count
    const failedCount = payload?.metadata?.failed_count

    const outputs = [
      ...(payload?.data?.image_urls ?? []).map((uri) => ({
        uri,
        ...(successCount !== undefined ? { successCount } : {}),
        ...(failedCount !== undefined ? { failedCount } : {}),
      })),
      ...(payload?.data?.image_base64 ?? []).map((base64) => ({
        base64,
        ...(successCount !== undefined ? { successCount } : {}),
        ...(failedCount !== undefined ? { failedCount } : {}),
      })),
    ]

    return {
      outputs,
      raw: {
        ...payload,
        id: payload?.id,
      },
    }
  }

  normalizeError(error: unknown): NormalizedProviderError {
    if (typeof error === 'object' && error !== null && 'payload' in error) {
      const err = error as {
        payload?: { base_resp?: { status_code?: number; status_msg?: string } }
        response?: Response
        networkError?: unknown
      }

      if (err.networkError) {
        const msg = err.networkError instanceof Error ? err.networkError.message : 'Network error'
        return { code: 'NETWORK_ERROR', message: `MiniMax network error: ${msg}`, raw: error }
      }

      const httpStatus = err.response?.status
      const statusCode = err.payload?.base_resp?.status_code
      const statusMsg = err.payload?.base_resp?.status_msg

      const result: { code?: string; status?: number; message: string; raw?: unknown } = {
        message: statusMsg ?? (httpStatus ? `MiniMax request failed (HTTP ${httpStatus})` : 'MiniMax request failed.'),
        raw: error,
      }

      if (statusCode !== undefined) {
        result.code = statusCode.toString()
      } else if (httpStatus !== undefined) {
        result.code = `HTTP_${httpStatus}`
      }

      if (httpStatus !== undefined) {
        result.status = httpStatus
      }

      return result
    }

    return normalizeUnknownError(error, 'MiniMax request failed.')
  }
}

export const minimaxAdaptor = new MiniMaxAdaptor()
