import { describe, expect, it } from 'bun:test'

import type { UnifiedRunInput } from '../domain'
import { minimaxAdaptor } from './minimax'

describe('MiniMaxAdaptor', () => {
  it('builds a text-to-image JSON request', async () => {
    const input: UnifiedRunInput = {
      providerId: 'minimax',
      modelId: 'image-01',
      auth: { apiKey: 'test-key' },
      operation: {
        kind: 'generate',
        prompt: 'A blue architectural study',
        aspectRatio: '4:3',
        numImages: 2,
        responseFormat: 'base64',
      },
      providerOptions: {
        promptOptimizer: true,
      },
    }

    const request = await minimaxAdaptor.buildRequest(input)

    expect(request.url).toBe('https://api.minimax.io/v1/image_generation')
    expect(request.bodyType).toBe('json')
    expect(request.body).toEqual({
      model: 'image-01',
      prompt: 'A blue architectural study',
      response_format: 'base64',
      prompt_optimizer: true,
      aspect_ratio: '4:3',
      n: 2,
    })
  })

  it('requires an edit image source', () => {
    const input: UnifiedRunInput = {
      providerId: 'minimax',
      modelId: 'image-01-live',
      auth: { apiKey: 'test-key' },
      operation: {
        kind: 'edit',
        prompt: 'Turn this into a poster',
        sourceArtifactId: 'artifact-1',
      },
    }

    const result = minimaxAdaptor.validateOperation(input)

    expect(result.ok).toBe(false)
    expect(result.errors).toContain('MiniMax edit mode requires a source image.')
  })

  it('builds subject_reference for MiniMax edit requests', async () => {
    const input: UnifiedRunInput = {
      providerId: 'minimax',
      modelId: 'image-01-live',
      auth: { apiKey: 'test-key' },
      operation: {
        kind: 'edit',
        prompt: 'Turn this portrait into a magazine poster',
        sourceArtifactId: 'artifact-1',
        responseFormat: 'base64',
      },
      imageInputs: [
        {
          kind: 'data-url',
          value: 'data:image/png;base64,ZmFrZQ==',
        },
      ],
    }

    const request = await minimaxAdaptor.buildRequest(input)

    expect(request.body).toEqual({
      model: 'image-01-live',
      prompt: 'Turn this portrait into a magazine poster',
      response_format: 'base64',
      prompt_optimizer: false,
      subject_reference: [
        {
          type: 'character',
          image_file: 'data:image/png;base64,ZmFrZQ==',
        },
      ],
    })
  })
})
