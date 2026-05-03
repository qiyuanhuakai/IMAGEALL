import { describe, expect, it } from 'bun:test'

import type { UnifiedRunInput } from '../domain'
import { stepfunAdaptor } from './stepfun'

describe('StepFunAdaptor', () => {
  it('builds step-image-edit-2 edit requests as JSON', async () => {
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
        },
      ],
      providerOptions: {
        textMode: true,
      },
    }

    const request = await stepfunAdaptor.buildRequest(input)

    expect(request.url).toBe('https://api.stepfun.com/v1/images/edits')
    expect(request.bodyType).toBe('json')
    expect(request.body).toEqual({
      model: 'step-image-edit-2',
      prompt: 'Make it into an editorial poster',
      response_format: 'b64_json',
      negative_prompt: 'muddy type',
      text_mode: true,
      image: 'data:image/png;base64,ZmFrZQ==',
    })
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

  it('routes step-1x-medium edit to image2image', async () => {
    const input: UnifiedRunInput = {
      providerId: 'stepfun',
      modelId: 'step-1x-medium',
      auth: { apiKey: 'step-key' },
      operation: {
        kind: 'edit',
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
})
