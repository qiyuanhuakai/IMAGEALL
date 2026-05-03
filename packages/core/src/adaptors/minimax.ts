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

const MINIMAX_BASE_URL = 'https://api.minimax.io'
const MINIMAX_ALLOWED_ASPECT_RATIOS = ['1:1', '16:9', '4:3', '3:2', '2:3', '3:4', '9:16', '21:9']

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

    if (input.operation.aspectRatio && !MINIMAX_ALLOWED_ASPECT_RATIOS.includes(input.operation.aspectRatio)) {
      errors.push(`Unsupported MiniMax aspect ratio: ${input.operation.aspectRatio}`)
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
    const response = await fetch(request.url, {
      method: request.method,
      ...(request.headers ? { headers: request.headers } : {}),
      body: JSON.stringify(request.body),
    })

    const payload = (await response.json()) as {
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
    }

    if (!response.ok || payload.base_resp?.status_code !== 0) {
      throw this.normalizeError({ response, payload })
    }

    const outputs = [
      ...(payload.data?.image_urls ?? []).map((uri) => ({ uri })),
      ...(payload.data?.image_base64 ?? []).map((base64) => ({ base64 })),
    ]

    return {
      outputs,
      raw: payload,
    }
  }

  normalizeError(error: unknown): NormalizedProviderError {
    if (typeof error === 'object' && error !== null && 'payload' in error) {
      const payload = (error as { payload?: { base_resp?: { status_code?: number; status_msg?: string } } }).payload
      const response = (error as { response?: Response }).response

      return {
        message: payload?.base_resp?.status_msg ?? 'MiniMax request failed.',
        ...(payload?.base_resp?.status_code !== undefined
          ? { code: payload.base_resp.status_code.toString() }
          : {}),
        ...(response?.status !== undefined ? { status: response.status } : {}),
        raw: error,
      }
    }

    return normalizeUnknownError(error, 'MiniMax request failed.')
  }
}

export const minimaxAdaptor = new MiniMaxAdaptor()
