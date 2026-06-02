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

const stepfunPlanManifest = requireProviderManifest('stepfun-plan', providerManifests)
const STEPFUN_PLAN_BASE_URL = 'https://api.stepfun.com/step_plan/v1'
const STEP_IMAGE_EDIT_2_SIZES = new Set(['1024x1024', '768x1360', '896x1184', '1360x768', '1184x896'])

function getStepFunPlanBaseUrl(input: UnifiedRunInput): string {
  const baseUrl = input.providerOptions?.baseUrl
  return typeof baseUrl === 'string' && baseUrl.trim().length > 0 ? baseUrl.trim() : STEPFUN_PLAN_BASE_URL
}

function toResponseFormat(input: UnifiedRunInput): 'url' | 'b64_json' {
  const requested = input.providerOptions?.responseFormat
  if (requested === 'b64_json' || input.operation.responseFormat === 'base64') {
    return 'b64_json'
  }

  return 'url'
}

function toStepImageEdit2Size(size?: { width: number; height: number }): string | undefined {
  if (!size) {
    return undefined
  }

  return `${size.height}x${size.width}`
}

function resolveImage(input: ImageInputSource): string | undefined {
  if (input.kind === 'url') {
    return isHttpUrl(input.value) ? input.value : undefined
  }

  if (input.kind === 'data-url') {
    return isDataUrl(input.value) ? input.value : undefined
  }

  return imageInputToDataUrl(input)
}

export class StepFunPlanAdaptor implements ImageProviderAdaptor {
  manifest: ImageProviderAdaptor['manifest'] = stepfunPlanManifest

  validateOperation(input: UnifiedRunInput): ValidationResult {
    const errors: string[] = []
    const model = findProviderModel(this.manifest, input.modelId)
    const prompt = requirePrompt(input)

    const apiKeyError = assertApiKey(input, this.manifest.label)
    if (apiKeyError) {
      errors.push(apiKeyError)
    }

    if (!model) {
      return fail(`Unsupported StepFun Plan model: ${input.modelId}`)
    }

    if (input.modelId !== 'step-image-edit-2') {
      errors.push('StepFun Plan currently supports only step-image-edit-2.')
    }

    if (!model.operations.includes(input.operation.kind)) {
      errors.push(`Model ${model.id} does not support ${input.operation.kind}.`)
    }

    if (input.operation.kind === 'upscale') {
      errors.push('StepFun Plan does not support upscale.')
    }

    if (!prompt) {
      errors.push('StepFun Plan requires a non-empty prompt.')
    }

    if (prompt && prompt.length > 512) {
      errors.push('StepFun Plan prompt exceeds the 512-character limit for step-image-edit-2.')
    }

    if (input.operation.numImages !== undefined && input.operation.numImages !== 1) {
      errors.push('StepFun Plan currently supports only one image per request.')
    }

    if (input.operation.size && input.operation.kind === 'generate') {
      const rendered = toStepImageEdit2Size(input.operation.size)
      if (!rendered || !STEP_IMAGE_EDIT_2_SIZES.has(rendered)) {
        errors.push(`Unsupported size ${rendered ?? 'unknown'} for step-image-edit-2.`)
      }
    }

    if (input.operation.kind === 'edit' && input.operation.size) {
      errors.push('StepFun Plan step-image-edit-2 edit ignores size; omit it from edit operations.')
    }

    if (input.operation.negativePrompt && input.operation.negativePrompt.length > 512) {
      errors.push('StepFun Plan negative_prompt must be 512 characters or fewer.')
    }

    if (input.operation.kind === 'edit') {
      const imageInput = requireImageInput(input)
      if (!imageInput) {
        errors.push('StepFun Plan edit mode requires a source image.')
      } else if (!resolveImage(imageInput)) {
        errors.push('StepFun Plan edit inputs must be a public URL, base64 payload, or data URL.')
      }
    }

    const steps = input.providerOptions?.steps
    if (steps !== undefined) {
      if (typeof steps !== 'number' || !Number.isInteger(steps)) {
        errors.push('StepFun Plan steps must be an integer.')
      } else if (steps < 1 || steps > 50) {
        errors.push('StepFun Plan step-image-edit-2 steps must be between 1 and 50.')
      }
    }

    const cfgScale = input.providerOptions?.cfgScale
    if (cfgScale !== undefined) {
      if (typeof cfgScale !== 'number') {
        errors.push('StepFun Plan cfgScale must be a number.')
      } else if (cfgScale < 1.0 || cfgScale > 10.0) {
        errors.push('StepFun Plan step-image-edit-2 cfg_scale must be between 1.0 and 10.0.')
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
      throw new Error('StepFun Plan API key is missing.')
    }

    const prompt = requirePrompt(input)
    if (!prompt) {
      throw new Error('StepFun Plan prompt is required.')
    }

    if (input.operation.kind === 'edit') {
      const imageInput = requireImageInput(input)
      if (!imageInput) {
        throw new Error('StepFun Plan edit requires an image input.')
      }

      const imageBlob = imageInputToBlob(imageInput)
      if (!imageBlob) {
        throw new Error('StepFun Plan step-image-edit-2 requires a base64 or data URL image payload.')
      }

      const formData = new FormData()
      formData.set('model', 'step-image-edit-2')
      formData.set('prompt', prompt)
      formData.set('response_format', toResponseFormat(input))
      formData.set('image', imageBlob, imageInput.filename ?? 'input.png')

      if (input.operation.seed !== undefined) {
        formData.set('seed', String(input.operation.seed))
      }

      if (input.operation.negativePrompt) {
        formData.set('negative_prompt', input.operation.negativePrompt)
      }

      if (typeof input.providerOptions?.textMode === 'boolean') {
        formData.set('text_mode', String(input.providerOptions.textMode))
      }

      if (input.providerOptions?.steps !== undefined) {
        formData.set('steps', String(input.providerOptions.steps))
      }

      if (input.providerOptions?.cfgScale !== undefined) {
        formData.set('cfg_scale', String(input.providerOptions.cfgScale))
      }

      return {
        url: `${getStepFunPlanBaseUrl(input)}/images/edits`,
        method: 'POST',
        bodyType: 'form-data',
        headers: createAuthOnlyHeaders(apiKey),
        body: formData,
      }
    }

    const body: Record<string, unknown> = {
      model: 'step-image-edit-2',
      prompt,
      response_format: toResponseFormat(input),
    }

    if (input.operation.seed !== undefined) {
      body.seed = input.operation.seed
    }

    if (input.operation.size) {
      const size = toStepImageEdit2Size(input.operation.size)
      if (size) {
        body.size = size
      }
    }

    if (input.operation.negativePrompt) {
      body.negative_prompt = input.operation.negativePrompt
    }

    if (typeof input.providerOptions?.textMode === 'boolean') {
      body.text_mode = input.providerOptions.textMode
    }

    if (input.providerOptions?.steps !== undefined) {
      body.steps = input.providerOptions.steps
    }

    if (input.providerOptions?.cfgScale !== undefined) {
      body.cfg_scale = input.providerOptions.cfgScale
    }

    return {
      url: `${getStepFunPlanBaseUrl(input)}/images/generations`,
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
      error?: {
        code?: string
        message?: string
      }
      data?: Array<{
        url?: string
        b64_json?: string
        seed?: number
      }>
    }

    if (!response.ok) {
      throw this.normalizeError({ response, payload })
    }

    return {
      outputs: (payload.data ?? []).flatMap((entry) => {
        const output = {
          ...(entry.url ? { uri: entry.url } : {}),
          ...(entry.b64_json ? { base64: entry.b64_json } : {}),
          ...(entry.seed !== undefined ? { seed: entry.seed } : {}),
        }

        return Object.keys(output).length > 0 ? [output] : []
      }),
      raw: payload,
    }
  }

  normalizeError(error: unknown): NormalizedProviderError {
    if (typeof error === 'object' && error !== null && 'payload' in error) {
      const payload = (error as { payload?: { error?: { code?: string; message?: string } } }).payload
      const response = (error as { response?: Response }).response

      return {
        message: payload?.error?.message ?? 'StepFun Plan request failed.',
        ...(payload?.error?.code ? { code: payload.error.code } : {}),
        ...(response?.status !== undefined ? { status: response.status } : {}),
        raw: error,
      }
    }

    return normalizeUnknownError(error, 'StepFun Plan request failed.')
  }
}

export const stepfunPlanAdaptor = new StepFunPlanAdaptor()
