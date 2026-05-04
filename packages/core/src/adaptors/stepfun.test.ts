import { describe, expect, it } from 'bun:test'

import type { UnifiedRunInput } from '../domain'
import { stepfunAdaptor } from './stepfun'

describe('StepFunAdaptor', () => {
  it('builds step-image-edit-2 edit requests as multipart form-data', async () => {
    const input: UnifiedRunInput = {
      providerId: 'stepfun',
      modelId: 'step-image-edit-2',
      auth: { apiKey: 'step-key' },
      operation: {
        kind: 'edit',
        prompt: 'Make it into an editorial poster',
        sourceArtifactId: 'artifact-1',
        negativePrompt: 'muddy type',
        responseFormat: 'base64',
      },
      imageInputs: [
        {
          kind: 'data-url',
          value: 'data:image/png;base64,ZmFrZQ==',
          filename: 'input.png',
        },
      ],
      providerOptions: {
        textMode: true,
      },
    }

    const request = await stepfunAdaptor.buildRequest(input)

    expect(request.url).toBe('https://api.stepfun.com/v1/images/edits')
    expect(request.bodyType).toBe('form-data')
    expect(request.body).toBeInstanceOf(FormData)
    const formData = request.body as FormData
    expect(formData.get('model')).toBe('step-image-edit-2')
    expect(formData.get('prompt')).toBe('Make it into an editorial poster')
    expect(formData.get('response_format')).toBe('b64_json')
    expect(formData.get('negative_prompt')).toBe('muddy type')
    expect(formData.get('text_mode')).toBe('true')
    expect(formData.get('image')).toBeInstanceOf(Blob)
  })

  it('uses multipart for step-1x-edit', async () => {
    const input: UnifiedRunInput = {
      providerId: 'stepfun',
      modelId: 'step-1x-edit',
      auth: { apiKey: 'step-key' },
      operation: {
        kind: 'edit',
        prompt: 'Turn this cat into a sketch',
        sourceArtifactId: 'artifact-1',
      },
      imageInputs: [
        {
          kind: 'data-url',
          value: 'data:image/png;base64,ZmFrZQ==',
          filename: 'cat.png',
        },
      ],
    }

    const request = await stepfunAdaptor.buildRequest(input)

    expect(request.url).toBe('https://api.stepfun.com/v1/images/edits')
    expect(request.bodyType).toBe('form-data')
    expect(request.body).toBeInstanceOf(FormData)
  })

  it('includes steps and cfg_scale for step-image-edit-2 generate', async () => {
    const input: UnifiedRunInput = {
      providerId: 'stepfun',
      modelId: 'step-image-edit-2',
      auth: { apiKey: 'step-key' },
      operation: {
        kind: 'generate',
        prompt: 'A beautiful landscape',
        size: { width: 1024, height: 1024 },
        responseFormat: 'url',
      },
      providerOptions: {
        steps: 25,
        cfgScale: 7.5,
      },
    }

    const request = await stepfunAdaptor.buildRequest(input)

    expect(request.body).toEqual({
      model: 'step-image-edit-2',
      prompt: 'A beautiful landscape',
      response_format: 'url',
      size: '1024x1024',
      steps: 25,
      cfg_scale: 7.5,
    })
  })

  it('includes steps and cfg_scale in step-image-edit-2 multipart form', async () => {
    const input: UnifiedRunInput = {
      providerId: 'stepfun',
      modelId: 'step-image-edit-2',
      auth: { apiKey: 'step-key' },
      operation: {
        kind: 'edit',
        prompt: 'Refine this image',
        sourceArtifactId: 'artifact-1',
      },
      imageInputs: [
        {
          kind: 'data-url',
          value: 'data:image/png;base64,ZmFrZQ==',
          filename: 'input.png',
        },
      ],
      providerOptions: {
        steps: 30,
        cfgScale: 5.0,
      },
    }

    const request = await stepfunAdaptor.buildRequest(input)

    expect(request.bodyType).toBe('form-data')
    const formData = request.body as FormData
    expect(formData.get('steps')).toBe('30')
    expect(formData.get('cfg_scale')).toBe('5')
  })

  it('includes steps and cfg_scale in step-1x-edit multipart form', async () => {
    const input: UnifiedRunInput = {
      providerId: 'stepfun',
      modelId: 'step-1x-edit',
      auth: { apiKey: 'step-key' },
      operation: {
        kind: 'edit',
        prompt: 'Turn this into a sketch',
        sourceArtifactId: 'artifact-1',
        size: { width: 512, height: 512 },
      },
      imageInputs: [
        {
          kind: 'data-url',
          value: 'data:image/png;base64,ZmFrZQ==',
          filename: 'cat.png',
        },
      ],
      providerOptions: {
        steps: 50,
        cfgScale: 6.0,
      },
    }

    const request = await stepfunAdaptor.buildRequest(input)

    expect(request.bodyType).toBe('form-data')
    const formData = request.body as FormData
    expect(formData.get('steps')).toBe('50')
    expect(formData.get('cfg_scale')).toBe('6')
  })

  it('validates steps range per model', () => {
    const baseGenerate = (modelId: string, steps: number) => ({
      providerId: 'stepfun',
      modelId,
      auth: { apiKey: 'step-key' },
      operation: { kind: 'generate' as const, prompt: 'test' },
      providerOptions: { steps },
    })

    const baseEdit = (modelId: string, steps: number) => ({
      providerId: 'stepfun',
      modelId,
      auth: { apiKey: 'step-key' },
      operation: { kind: 'edit' as const, prompt: 'test', sourceArtifactId: 'a-1' },
      imageInputs: [{ kind: 'data-url' as const, value: 'data:image/png;base64,ZmFrZQ==' }],
      providerOptions: { steps },
    })

    expect(stepfunAdaptor.validateOperation(baseGenerate('step-image-edit-2', 0)).ok).toBe(false)
    expect(stepfunAdaptor.validateOperation(baseGenerate('step-image-edit-2', 51)).ok).toBe(false)
    expect(stepfunAdaptor.validateOperation(baseGenerate('step-image-edit-2', 25)).ok).toBe(true)

    expect(stepfunAdaptor.validateOperation(baseGenerate('step-1x-medium', 0)).ok).toBe(false)
    expect(stepfunAdaptor.validateOperation(baseGenerate('step-1x-medium', 101)).ok).toBe(false)
    expect(stepfunAdaptor.validateOperation(baseGenerate('step-1x-medium', 50)).ok).toBe(true)

    expect(stepfunAdaptor.validateOperation(baseEdit('step-1x-edit', 0)).ok).toBe(false)
    expect(stepfunAdaptor.validateOperation(baseEdit('step-1x-edit', 101)).ok).toBe(false)
    expect(stepfunAdaptor.validateOperation(baseEdit('step-1x-edit', 28)).ok).toBe(true)
  })

  it('validates cfg_scale range per model', () => {
    const baseGenerate = (modelId: string, cfgScale: number) => ({
      providerId: 'stepfun',
      modelId,
      auth: { apiKey: 'step-key' },
      operation: { kind: 'generate' as const, prompt: 'test' },
      providerOptions: { cfgScale },
    })

    const baseEdit = (modelId: string, cfgScale: number) => ({
      providerId: 'stepfun',
      modelId,
      auth: { apiKey: 'step-key' },
      operation: { kind: 'edit' as const, prompt: 'test', sourceArtifactId: 'a-1' },
      imageInputs: [{ kind: 'data-url' as const, value: 'data:image/png;base64,ZmFrZQ==' }],
      providerOptions: { cfgScale },
    })

    expect(stepfunAdaptor.validateOperation(baseGenerate('step-image-edit-2', 0.5)).ok).toBe(false)
    expect(stepfunAdaptor.validateOperation(baseGenerate('step-image-edit-2', 10.5)).ok).toBe(false)
    expect(stepfunAdaptor.validateOperation(baseGenerate('step-image-edit-2', 1.0)).ok).toBe(true)
    expect(stepfunAdaptor.validateOperation(baseGenerate('step-image-edit-2', 10.0)).ok).toBe(true)

    expect(stepfunAdaptor.validateOperation(baseGenerate('step-1x-medium', 0.5)).ok).toBe(false)
    expect(stepfunAdaptor.validateOperation(baseGenerate('step-1x-medium', 10.5)).ok).toBe(false)
    expect(stepfunAdaptor.validateOperation(baseGenerate('step-1x-medium', 7.5)).ok).toBe(true)

    expect(stepfunAdaptor.validateOperation(baseEdit('step-1x-edit', 0.5)).ok).toBe(false)
    expect(stepfunAdaptor.validateOperation(baseEdit('step-1x-edit', 10.5)).ok).toBe(false)
    expect(stepfunAdaptor.validateOperation(baseEdit('step-1x-edit', 6.0)).ok).toBe(true)
  })

  it('routes step-1x-medium image2image to image2image endpoint', async () => {
    const input: UnifiedRunInput = {
      providerId: 'stepfun',
      modelId: 'step-1x-medium',
      auth: { apiKey: 'step-key' },
      operation: {
        kind: 'image2image',
        prompt: 'Turn this into a calmer print poster',
        sourceArtifactId: 'artifact-1',
      },
      imageInputs: [
        {
          kind: 'url',
          value: 'https://example.com/source.png',
        },
      ],
      providerOptions: {
        sourceWeight: 0.35,
      },
    }

    const request = await stepfunAdaptor.buildRequest(input)

    expect(request.url).toBe('https://api.stepfun.com/v1/images/image2image')
    expect(request.bodyType).toBe('json')
    expect(request.body).toEqual({
      model: 'step-1x-medium',
      prompt: 'Turn this into a calmer print poster',
      response_format: 'url',
      source_url: 'https://example.com/source.png',
      source_weight: 0.35,
    })
  })

  it('validates image2image requires reference image', () => {
    const result = stepfunAdaptor.validateOperation({
      providerId: 'stepfun',
      modelId: 'step-1x-medium',
      auth: { apiKey: 'step-key' },
      operation: {
        kind: 'image2image',
        prompt: 'test',
        sourceArtifactId: 'a-1',
      },
    })

    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.includes('reference image'))).toBe(true)
  })

  it('validates image2image source_weight range', () => {
    const base = (sourceWeight: number) => ({
      providerId: 'stepfun',
      modelId: 'step-1x-medium',
      auth: { apiKey: 'step-key' },
      operation: { kind: 'image2image' as const, prompt: 'test', sourceArtifactId: 'a-1' },
      imageInputs: [{ kind: 'data-url' as const, value: 'data:image/png;base64,ZmFrZQ==' }],
      providerOptions: { sourceWeight },
    })

    expect(stepfunAdaptor.validateOperation(base(0)).ok).toBe(false)
    expect(stepfunAdaptor.validateOperation(base(-0.1)).ok).toBe(false)
    expect(stepfunAdaptor.validateOperation(base(1.1)).ok).toBe(false)
    expect(stepfunAdaptor.validateOperation(base(0.05)).ok).toBe(true)
    expect(stepfunAdaptor.validateOperation(base(1)).ok).toBe(true)
    expect(stepfunAdaptor.validateOperation(base(0.5)).ok).toBe(true)
  })
})
