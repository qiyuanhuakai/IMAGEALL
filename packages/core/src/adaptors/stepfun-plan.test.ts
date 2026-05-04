import { describe, expect, it } from 'bun:test'

import type { UnifiedRunInput } from '../domain'
import { stepfunPlanAdaptor } from './stepfun-plan'

describe('StepFunPlanAdaptor', () => {
  it('builds step-image-edit-2 generate requests against step_plan', async () => {
    const input: UnifiedRunInput = {
      providerId: 'stepfun-plan',
      modelId: 'step-image-edit-2',
      auth: { apiKey: 'step-key' },
      operation: {
        kind: 'generate',
        prompt: 'A typography-heavy campaign poster',
        size: { width: 1360, height: 768 },
        responseFormat: 'base64',
      },
      providerOptions: {
        textMode: true,
      },
    }

    const request = await stepfunPlanAdaptor.buildRequest(input)

    expect(request.url).toBe('https://api.stepfun.com/step_plan/v1/images/generations')
    expect(request.body).toEqual({
      model: 'step-image-edit-2',
      prompt: 'A typography-heavy campaign poster',
      response_format: 'b64_json',
      size: '768x1360',
      text_mode: true,
    })
  })

  it('includes steps and cfg_scale in generate requests', async () => {
    const input: UnifiedRunInput = {
      providerId: 'stepfun-plan',
      modelId: 'step-image-edit-2',
      auth: { apiKey: 'step-key' },
      operation: {
        kind: 'generate',
        prompt: 'A poster with bold text',
        size: { width: 1024, height: 1024 },
        responseFormat: 'base64',
      },
      providerOptions: {
        textMode: true,
        steps: 30,
        cfgScale: 5.0,
      },
    }

    const request = await stepfunPlanAdaptor.buildRequest(input)

    expect(request.body).toEqual({
      model: 'step-image-edit-2',
      prompt: 'A poster with bold text',
      response_format: 'b64_json',
      size: '1024x1024',
      text_mode: true,
      steps: 30,
      cfg_scale: 5.0,
    })
  })

  it('includes steps and cfg_scale in edit requests as multipart form-data', async () => {
    const input: UnifiedRunInput = {
      providerId: 'stepfun-plan',
      modelId: 'step-image-edit-2',
      auth: { apiKey: 'step-key' },
      operation: {
        kind: 'edit',
        prompt: 'Add text overlay',
        sourceArtifactId: 'artifact-1',
        negativePrompt: 'blurry',
      },
      imageInputs: [
        {
          kind: 'data-url',
          value: 'data:image/png;base64,ZmFrZQ==',
          filename: 'source.png',
        },
      ],
      providerOptions: {
        steps: 15,
        cfgScale: 3.0,
      },
    }

    const request = await stepfunPlanAdaptor.buildRequest(input)

    expect(request.url).toBe('https://api.stepfun.com/step_plan/v1/images/edits')
    expect(request.bodyType).toBe('form-data')
    expect(request.body).toBeInstanceOf(FormData)
    const formData = request.body as FormData
    expect(formData.get('model')).toBe('step-image-edit-2')
    expect(formData.get('prompt')).toBe('Add text overlay')
    expect(formData.get('response_format')).toBe('url')
    expect(formData.get('negative_prompt')).toBe('blurry')
    expect(formData.get('steps')).toBe('15')
    expect(formData.get('cfg_scale')).toBe('3')
    expect(formData.get('image')).toBeInstanceOf(Blob)
  })

  it('validates steps range for step-image-edit-2', () => {
    const base = (steps: number) => ({
      providerId: 'stepfun-plan',
      modelId: 'step-image-edit-2',
      auth: { apiKey: 'step-key' },
      operation: { kind: 'generate' as const, prompt: 'test' },
      providerOptions: { steps },
    })

    expect(stepfunPlanAdaptor.validateOperation(base(0)).ok).toBe(false)
    expect(stepfunPlanAdaptor.validateOperation(base(51)).ok).toBe(false)
    expect(stepfunPlanAdaptor.validateOperation(base(1)).ok).toBe(true)
    expect(stepfunPlanAdaptor.validateOperation(base(50)).ok).toBe(true)
    expect(stepfunPlanAdaptor.validateOperation(base(25)).ok).toBe(true)
  })

  it('validates cfg_scale range for step-image-edit-2', () => {
    const base = (cfgScale: number) => ({
      providerId: 'stepfun-plan',
      modelId: 'step-image-edit-2',
      auth: { apiKey: 'step-key' },
      operation: { kind: 'generate' as const, prompt: 'test' },
      providerOptions: { cfgScale },
    })

    expect(stepfunPlanAdaptor.validateOperation(base(0.5)).ok).toBe(false)
    expect(stepfunPlanAdaptor.validateOperation(base(10.5)).ok).toBe(false)
    expect(stepfunPlanAdaptor.validateOperation(base(1.0)).ok).toBe(true)
    expect(stepfunPlanAdaptor.validateOperation(base(10.0)).ok).toBe(true)
    expect(stepfunPlanAdaptor.validateOperation(base(7.5)).ok).toBe(true)
  })

  it('rejects non-step-image-edit-2 models', () => {
    const result = stepfunPlanAdaptor.validateOperation({
      providerId: 'stepfun-plan',
      modelId: 'step-1x-medium',
      auth: { apiKey: 'step-key' },
      operation: {
        kind: 'generate',
        prompt: 'hello',
      },
    })

    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.includes('step-image-edit-2') || e.includes('Unsupported'))).toBe(true)
  })
})
