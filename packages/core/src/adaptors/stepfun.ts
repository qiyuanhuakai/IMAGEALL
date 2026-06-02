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
  createAuthOnlyHeaders,
  createBearerHeaders,
  fail,
  findProviderModel,
  imageInputToBlob,
  imageInputToDataUrl,
  isDataUrl,
  isHttpUrl,
  normalizeUnknownError,
  ok,
  requireProviderManifest,
  requireImageInput,
  requirePrompt,
} from './helpers'

const stepfunManifest = requireProviderManifest('stepfun', providerManifests)

const STEPFUN_BASE_URL = 'https://api.stepfun.com/v1'
const STEP_1X_MEDIUM_SIZES = new Set(['256x256', '512x512', '768x768', '1024x1024', '1280x800', '800x1280'])
const STEP_1X_EDIT_SIZES = new Set(['512x512', '768x768', '1024x1024'])
const STEP_IMAGE_EDIT_2_SIZES = new Set(['1024x1024', '768x1360', '896x1184', '1360x768', '1184x896'])

function getStepFunBaseUrl(input: UnifiedRunInput): string {
  const baseUrl = input.providerOptions?.baseUrl
  return typeof baseUrl === 'string' && baseUrl.trim().length > 0 ? baseUrl.trim() : STEPFUN_BASE_URL
}

function toStepFunResponseFormat(input: UnifiedRunInput): 'url' | 'b64_json' {
  const requested = input.providerOptions?.responseFormat

  if (requested === 'b64_json') {
    return 'b64_json'
  }

  if (input.operation.responseFormat === 'base64') {
    return 'b64_json'
  }

  return 'url'
}

function toStepFunSize(modelId: string, size?: { width: number; height: number }): string | undefined {
  if (!size) {
    return undefined
  }

  if (modelId === 'step-image-edit-2') {
    return `${size.height}x${size.width}`
  }

  return `${size.width}x${size.height}`
}

function isValidUrlOrDataUrl(input: ImageInputSource): boolean {
  if (input.kind === 'url') {
    return isHttpUrl(input.value)
  }

  if (input.kind === 'data-url') {
    return isDataUrl(input.value)
  }

  return input.kind === 'base64'
}

function resolveStepFunImage(input: ImageInputSource): string | undefined {
  if (input.kind === 'url') {
    return input.value
  }

  return imageInputToDataUrl(input)
}

function getStyleReference(input: UnifiedRunInput): { source_url: string; weight?: number } | undefined {
  const source = input.providerOptions?.styleReferenceSource
  if (typeof source !== 'string' || source.trim().length === 0) {
    return undefined
  }

  const weight = input.providerOptions?.styleReferenceWeight

  return {
    source_url: source.trim(),
    ...(typeof weight === 'number' ? { weight } : {}),
  }
}

function validateStepFunSize(modelId: string, size?: { width: number; height: number }): string | undefined {
  if (!size) {
    return undefined
  }

  const rendered = toStepFunSize(modelId, size)

  if (!rendered) {
    return undefined
  }

  if (modelId === 'step-1x-medium' && !STEP_1X_MEDIUM_SIZES.has(rendered)) {
    return `Unsupported size ${rendered} for step-1x-medium.`
  }

  if (modelId === 'step-1x-edit' && !STEP_1X_EDIT_SIZES.has(rendered)) {
    return `Unsupported size ${rendered} for step-1x-edit.`
  }

  if (modelId === 'step-image-edit-2' && !STEP_IMAGE_EDIT_2_SIZES.has(rendered)) {
    return `Unsupported size ${rendered} for step-image-edit-2.`
  }

  return undefined
}

function endpointForStepFun(input: UnifiedRunInput): '/images/generations' | '/images/edits' | '/images/image2image' {
  if (input.operation.kind === 'generate') {
    return '/images/generations'
  }

  if (input.operation.kind === 'image2image') {
    return '/images/image2image'
  }

  return '/images/edits'
}

export class StepFunAdaptor implements ImageProviderAdaptor {
  manifest: ImageProviderAdaptor['manifest'] = stepfunManifest

  validateOperation(input: UnifiedRunInput): ValidationResult {
    const errors: string[] = []
    const model = findProviderModel(this.manifest, input.modelId)
    const prompt = requirePrompt(input)

    const apiKeyError = assertApiKey(input, this.manifest.label)
    if (apiKeyError) {
      errors.push(apiKeyError)
    }

    if (!model) {
      errors.push(`Unsupported StepFun model: ${input.modelId}`)
      return fail(...errors)
    }

    if (!model.operations.includes(input.operation.kind)) {
      errors.push(`Model ${model.id} does not support ${input.operation.kind}.`)
    }

    if (!prompt) {
      errors.push('StepFun requires a non-empty prompt.')
    }

    const promptLimit = model.constraints?.promptMaxLength
    if (prompt && promptLimit && prompt.length > promptLimit) {
      errors.push(`StepFun prompt exceeds the ${promptLimit}-character limit for ${model.id}.`)
    }

    if (input.operation.numImages !== undefined && input.operation.numImages !== 1) {
      errors.push('StepFun currently supports only one image per request.')
    }

    const sizeError = validateStepFunSize(model.id, input.operation.size)
    if (sizeError) {
      errors.push(sizeError)
    }

    if (input.modelId === 'step-image-edit-2' && input.operation.kind === 'edit' && input.operation.size) {
      errors.push('StepFun step-image-edit-2 edit ignores size; omit it from edit operations.')
    }

    if (input.operation.kind === 'edit') {
      const imageInput = requireImageInput(input)

      if (!imageInput) {
        errors.push('StepFun edit mode requires a source image.')
      } else if (input.modelId === 'step-1x-edit') {
        if (imageInput.kind === 'url') {
          errors.push('StepFun step-1x-edit requires binary image data, not a URL reference.')
        }
      } else if (!isValidUrlOrDataUrl(imageInput)) {
        errors.push('StepFun edit inputs must be a URL, base64 payload, or data URL.')
      }
    }

    if (input.operation.kind === 'image2image') {
      const imageInput = requireImageInput(input)

      if (!imageInput) {
        errors.push('StepFun image2image mode requires a reference image.')
      } else if (!isValidUrlOrDataUrl(imageInput)) {
        errors.push('StepFun image2image reference must be a URL, base64 payload, or data URL.')
      }

      const sourceWeight = input.providerOptions?.sourceWeight
      if (sourceWeight !== undefined && (typeof sourceWeight !== 'number' || sourceWeight <= 0 || sourceWeight > 1)) {
        errors.push('StepFun image2image source_weight must be in range (0, 1].')
      }
    }

    if (input.modelId === 'step-image-edit-2' && input.operation.negativePrompt && input.operation.negativePrompt.length > 512) {
      errors.push('StepFun step-image-edit-2 negative_prompt must be 512 characters or fewer.')
    }

    if (input.modelId !== 'step-image-edit-2' && input.operation.negativePrompt) {
      errors.push(`negative_prompt is not supported on ${input.modelId}.`)
    }

    if (input.modelId === 'step-1x-medium') {
      const styleReference = getStyleReference(input)
      if (styleReference && !isHttpUrl(styleReference.source_url) && !isDataUrl(styleReference.source_url)) {
        errors.push('StepFun style_reference.source_url must be a public URL or data URL.')
      }
    }

    const textMode = input.providerOptions?.textMode
    if (textMode !== undefined && typeof textMode !== 'boolean') {
      errors.push('StepFun textMode must be a boolean when provided.')
    }

    const steps = input.providerOptions?.steps
    if (steps !== undefined) {
      if (typeof steps !== 'number' || !Number.isInteger(steps)) {
        errors.push('StepFun steps must be an integer.')
      } else if (input.modelId === 'step-image-edit-2' && (steps < 1 || steps > 50)) {
        errors.push('StepFun step-image-edit-2 steps must be between 1 and 50.')
      } else if ((input.modelId === 'step-1x-medium' || input.modelId === 'step-1x-edit') && (steps < 1 || steps > 100)) {
        errors.push(`StepFun ${input.modelId} steps must be between 1 and 100.`)
      }
    }

    const cfgScale = input.providerOptions?.cfgScale
    if (cfgScale !== undefined) {
      if (typeof cfgScale !== 'number') {
        errors.push('StepFun cfgScale must be a number.')
      } else if (input.modelId === 'step-image-edit-2' && (cfgScale < 1.0 || cfgScale > 10.0)) {
        errors.push('StepFun step-image-edit-2 cfg_scale must be between 1.0 and 10.0.')
      } else if ((input.modelId === 'step-1x-medium' || input.modelId === 'step-1x-edit') && (cfgScale < 1.0 || cfgScale > 10.0)) {
        errors.push(`StepFun ${input.modelId} cfg_scale must be between 1.0 and 10.0.`)
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
      throw new Error('StepFun API key is missing.')
    }

    const prompt = requirePrompt(input)
    if (!prompt) {
      throw new Error('StepFun prompt is required.')
    }

    const endpoint = endpointForStepFun(input)
    const url = `${getStepFunBaseUrl(input)}${endpoint}`

    if (input.operation.kind === 'edit' && (input.modelId === 'step-1x-edit' || input.modelId === 'step-image-edit-2')) {
      const imageInput = requireImageInput(input)
      if (!imageInput) {
        throw new Error(`StepFun ${input.modelId} requires image data.`)
      }

      const imageBlob = imageInputToBlob(imageInput)
      if (!imageBlob) {
        throw new Error(`StepFun ${input.modelId} requires a base64 or data URL image payload.`)
      }

      const formData = new FormData()
      formData.set('model', input.modelId)
      formData.set('prompt', prompt)
      formData.set('image', imageBlob, imageInput.filename ?? 'input.png')
      formData.set('response_format', toStepFunResponseFormat(input))

      if (input.operation.seed !== undefined) {
        formData.set('seed', String(input.operation.seed))
      }

      if (input.modelId === 'step-1x-edit' && input.operation.size) {
        formData.set('size', toStepFunSize(input.modelId, input.operation.size) ?? '')
      }

      if (input.providerOptions?.steps !== undefined) {
        formData.set('steps', String(input.providerOptions.steps))
      }

      if (input.providerOptions?.cfgScale !== undefined) {
        formData.set('cfg_scale', String(input.providerOptions.cfgScale))
      }

      if (input.modelId === 'step-image-edit-2') {
        if (input.operation.negativePrompt) {
          formData.set('negative_prompt', input.operation.negativePrompt)
        }

        if (typeof input.providerOptions?.textMode === 'boolean') {
          formData.set('text_mode', String(input.providerOptions.textMode))
        }
      }

      return {
        url,
        method: 'POST',
        bodyType: 'form-data',
        headers: createAuthOnlyHeaders(apiKey),
        body: formData,
      }
    }

    const body: Record<string, unknown> = {
      model: input.modelId,
      prompt,
      response_format: toStepFunResponseFormat(input),
    }

    if (input.operation.seed !== undefined) {
      body.seed = input.operation.seed
    }

    if (input.operation.size) {
      const size = toStepFunSize(input.modelId, input.operation.size)
      if (size) {
        body.size = size
      }
    }

    if (input.providerOptions?.steps !== undefined) {
      body.steps = input.providerOptions.steps
    }

    if (input.providerOptions?.cfgScale !== undefined) {
      body.cfg_scale = input.providerOptions.cfgScale
    }

    if (input.operation.kind === 'generate' && input.modelId === 'step-1x-medium') {
      const styleReference = getStyleReference(input)
      if (styleReference) {
        body.style_reference = styleReference
      }
    }

    if (input.operation.kind === 'image2image') {
      const imageInput = requireImageInput(input)
      if (!imageInput) {
        throw new Error('StepFun image2image requires a reference image.')
      }

      const sourceUrl = resolveStepFunImage(imageInput)
      if (!sourceUrl) {
        throw new Error('StepFun image2image requires a URL or data URL source.')
      }

      body.source_url = sourceUrl
      body.source_weight = typeof input.providerOptions?.sourceWeight === 'number' ? input.providerOptions.sourceWeight : 0.5
    }

    return {
      url,
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
      body: request.bodyType === 'json' ? JSON.stringify(request.body) : (request.body as FormData),
    })

    const payload = (await response.json()) as {
      error?: {
        code?: string
        message?: string
        param?: string
      }
      data?: Array<{
        url?: string
        b64_json?: string
        image?: string
        finish_reason?: string
        seed?: number
      }>
    }

    if (!response.ok) {
      throw this.normalizeError({ response, payload })
    }

    const outputs = (payload.data ?? []).flatMap((entry) => {
      const output = {
        ...(entry.url ? { uri: entry.url } : {}),
        ...(entry.b64_json ? { base64: entry.b64_json } : {}),
        ...(entry.image ? { base64: entry.image } : {}),
        ...(entry.seed !== undefined ? { seed: entry.seed } : {}),
      }

      return Object.keys(output).length > 0 ? [output] : []
    })

    return {
      outputs,
      raw: payload,
    }
  }

  normalizeError(error: unknown): NormalizedProviderError {
    if (typeof error === 'object' && error !== null && 'payload' in error) {
      const payload = (error as { payload?: { error?: { code?: string; message?: string } } }).payload
      const response = (error as { response?: Response }).response

      return {
        message: payload?.error?.message ?? 'StepFun request failed.',
        ...(payload?.error?.code ? { code: payload.error.code } : {}),
        ...(response?.status !== undefined ? { status: response.status } : {}),
        raw: error,
      }
    }

    return normalizeUnknownError(error, 'StepFun request failed.')
  }
}

export const stepfunAdaptor = new StepFunAdaptor()
