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

    expect(request.url).toBe('https://api.minimaxi.com/v1/image_generation')
    expect(request.bodyType).toBe('json')
    expect(request.body).toEqual({
      model: 'image-01',
      prompt: 'A blue architectural study',
      response_format: 'base64',
      prompt_optimizer: true,
      aigc_watermark: false,
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
      aigc_watermark: false,
      subject_reference: [
        {
          type: 'character',
          image_file: 'data:image/png;base64,ZmFrZQ==',
        },
      ],
    })
  })

  it('passes aigc_watermark when enabled', async () => {
    const input: UnifiedRunInput = {
      providerId: 'minimax',
      modelId: 'image-01',
      auth: { apiKey: 'test-key' },
      operation: {
        kind: 'generate',
        prompt: 'A sunset over mountains',
      },
      providerOptions: {
        aigcWatermark: true,
      },
    }

    const request = await minimaxAdaptor.buildRequest(input)
    const body = request.body as Record<string, unknown>

    expect(body.aigc_watermark).toBe(true)
  })

  it('rejects non-boolean aigcWatermark', () => {
    const input: UnifiedRunInput = {
      providerId: 'minimax',
      modelId: 'image-01',
      auth: { apiKey: 'test-key' },
      operation: {
        kind: 'generate',
        prompt: 'test',
      },
      providerOptions: {
        aigcWatermark: 'yes',
      },
    }

    const result = minimaxAdaptor.validateOperation(input)

    expect(result.ok).toBe(false)
    expect(result.errors).toContain('MiniMax aigcWatermark must be a boolean when provided.')
  })

  it('builds style for image-01-live', async () => {
    const input: UnifiedRunInput = {
      providerId: 'minimax',
      modelId: 'image-01-live',
      auth: { apiKey: 'test-key' },
      operation: {
        kind: 'edit',
        prompt: 'Make this look like anime',
        sourceArtifactId: 'artifact-1',
      },
      imageInputs: [
        {
          kind: 'data-url',
          value: 'data:image/png;base64,ZmFrZQ==',
        },
      ],
      providerOptions: {
        styleType: '漫画',
        styleWeight: 0.5,
      },
    }

    const request = await minimaxAdaptor.buildRequest(input)
    const body = request.body as Record<string, unknown>

    expect(body.style).toEqual({
      style_type: '漫画',
      style_weight: 0.5,
    })
  })

  it('rejects invalid styleType', () => {
    const input: UnifiedRunInput = {
      providerId: 'minimax',
      modelId: 'image-01-live',
      auth: { apiKey: 'test-key' },
      operation: {
        kind: 'edit',
        prompt: 'test',
        sourceArtifactId: 'artifact-1',
      },
      imageInputs: [
        {
          kind: 'data-url',
          value: 'data:image/png;base64,ZmFrZQ==',
        },
      ],
      providerOptions: {
        styleType: '油画',
      },
    }

    const result = minimaxAdaptor.validateOperation(input)

    expect(result.ok).toBe(false)
    expect(result.errors).toContain('MiniMax styleType must be one of: 漫画, 元气, 中世纪, 水彩.')
  })

  it('rejects styleWeight out of range', () => {
    const input: UnifiedRunInput = {
      providerId: 'minimax',
      modelId: 'image-01-live',
      auth: { apiKey: 'test-key' },
      operation: {
        kind: 'edit',
        prompt: 'test',
        sourceArtifactId: 'artifact-1',
      },
      imageInputs: [
        {
          kind: 'data-url',
          value: 'data:image/png;base64,ZmFrZQ==',
        },
      ],
      providerOptions: {
        styleType: '元气',
        styleWeight: 1.5,
      },
    }

    const result = minimaxAdaptor.validateOperation(input)

    expect(result.ok).toBe(false)
    expect(result.errors).toContain('MiniMax styleWeight must be a number in (0, 1].')
  })

  it('rejects styleType on non-live models', () => {
    const input: UnifiedRunInput = {
      providerId: 'minimax',
      modelId: 'image-01',
      auth: { apiKey: 'test-key' },
      operation: {
        kind: 'generate',
        prompt: 'test',
      },
      providerOptions: {
        styleType: '漫画',
      },
    }

    const result = minimaxAdaptor.validateOperation(input)

    expect(result.ok).toBe(false)
    expect(result.errors).toContain('MiniMax styleType is only supported for image-01-live.')
  })

  it('uses default aspect ratio and watermark when not specified', async () => {
    const input: UnifiedRunInput = {
      providerId: 'minimax',
      modelId: 'image-01',
      auth: { apiKey: 'test-key' },
      operation: {
        kind: 'generate',
        prompt: 'A minimal test image',
      },
    }

    const request = await minimaxAdaptor.buildRequest(input)
    const body = request.body as Record<string, unknown>

    expect(body.response_format).toBe('url')
    expect(body.prompt_optimizer).toBe(false)
    expect(body.aigc_watermark).toBe(false)
  })

  it('normalizes network errors with NETWORK_ERROR code', () => {
    const error = minimaxAdaptor.normalizeError({
      response: undefined,
      payload: undefined,
      networkError: new Error('Connection refused'),
    })

    expect(error.code).toBe('NETWORK_ERROR')
    expect(error.message).toBe('MiniMax network error: Connection refused')
  })

  it('normalizes HTTP errors without JSON payload', () => {
    const mockResponse = { status: 500 } as Response
    const error = minimaxAdaptor.normalizeError({
      response: mockResponse,
      payload: undefined,
    })

    expect(error.code).toBe('HTTP_500')
    expect(error.message).toBe('MiniMax request failed (HTTP 500)')
    expect(error.status).toBe(500)
  })

  it('normalizes MiniMax API errors with provider status code', () => {
    const mockResponse = { status: 200 } as Response
    const error = minimaxAdaptor.normalizeError({
      response: mockResponse,
      payload: {
        base_resp: {
          status_code: 1004,
          status_msg: '账号鉴权失败',
        },
      },
    })

    expect(error.code).toBe('1004')
    expect(error.message).toBe('账号鉴权失败')
    expect(error.status).toBe(200)
  })

  it('normalizes MiniMax content safety errors', () => {
    const mockResponse = { status: 200 } as Response
    const error = minimaxAdaptor.normalizeError({
      response: mockResponse,
      payload: {
        base_resp: {
          status_code: 1026,
          status_msg: '图片描述涉及敏感内容',
        },
      },
    })

    expect(error.code).toBe('1026')
    expect(error.message).toBe('图片描述涉及敏感内容')
  })

  it('normalizes unknown errors with fallback message', () => {
    const error = minimaxAdaptor.normalizeError('something went wrong')

    expect(error.message).toBe('MiniMax request failed.')
  })

  it('allows generate operation for image-01-live', () => {
    const input: UnifiedRunInput = {
      providerId: 'minimax',
      modelId: 'image-01-live',
      auth: { apiKey: 'test-key' },
      operation: {
        kind: 'generate',
        prompt: 'A stylized portrait',
        aspectRatio: '1:1',
      },
    }

    const result = minimaxAdaptor.validateOperation(input)

    expect(result.ok).toBe(true)
  })

  it('rejects 21:9 aspect ratio for image-01-live', () => {
    const input: UnifiedRunInput = {
      providerId: 'minimax',
      modelId: 'image-01-live',
      auth: { apiKey: 'test-key' },
      operation: {
        kind: 'generate',
        prompt: 'test',
        aspectRatio: '21:9',
      },
    }

    const result = minimaxAdaptor.validateOperation(input)

    expect(result.ok).toBe(false)
    expect(result.errors).toContain('Unsupported MiniMax aspect ratio for image-01-live: 21:9')
  })

  it('allows 21:9 aspect ratio for image-01', () => {
    const input: UnifiedRunInput = {
      providerId: 'minimax',
      modelId: 'image-01',
      auth: { apiKey: 'test-key' },
      operation: {
        kind: 'generate',
        prompt: 'test',
        aspectRatio: '21:9',
      },
    }

    const result = minimaxAdaptor.validateOperation(input)

    expect(result.ok).toBe(true)
  })

  it('passes aspect_ratio for image-01-live generate requests', async () => {
    const input: UnifiedRunInput = {
      providerId: 'minimax',
      modelId: 'image-01-live',
      auth: { apiKey: 'test-key' },
      operation: {
        kind: 'generate',
        prompt: 'A stylized portrait',
        aspectRatio: '16:9',
        responseFormat: 'url',
      },
    }

    const request = await minimaxAdaptor.buildRequest(input)
    const body = request.body as Record<string, unknown>

    expect(body.aspect_ratio).toBe('16:9')
    expect(body.width).toBeUndefined()
    expect(body.height).toBeUndefined()
  })

  it('builds image-01-live generate with style', async () => {
    const input: UnifiedRunInput = {
      providerId: 'minimax',
      modelId: 'image-01-live',
      auth: { apiKey: 'test-key' },
      operation: {
        kind: 'generate',
        prompt: 'A watercolor landscape',
        aspectRatio: '4:3',
      },
      providerOptions: {
        styleType: '水彩',
        styleWeight: 0.9,
      },
    }

    const request = await minimaxAdaptor.buildRequest(input)
    const body = request.body as Record<string, unknown>

    expect(body.style).toEqual({ style_type: '水彩', style_weight: 0.9 })
    expect(body.aspect_ratio).toBe('4:3')
  })

  it('rejects custom size for image-01-live', () => {
    const input: UnifiedRunInput = {
      providerId: 'minimax',
      modelId: 'image-01-live',
      auth: { apiKey: 'test-key' },
      operation: {
        kind: 'generate',
        prompt: 'test',
        size: { width: 800, height: 600 },
      },
    }

    const result = minimaxAdaptor.validateOperation(input)

    expect(result.ok).toBe(false)
    expect(result.errors).toContain('MiniMax custom width/height is only documented for image-01.')
  })

  it('uses default style_weight 0.8 when styleType is set without styleWeight', async () => {
    const input: UnifiedRunInput = {
      providerId: 'minimax',
      modelId: 'image-01-live',
      auth: { apiKey: 'test-key' },
      operation: {
        kind: 'generate',
        prompt: 'A stylized portrait',
        aspectRatio: '1:1',
      },
      providerOptions: {
        styleType: '漫画',
      },
    }

    const request = await minimaxAdaptor.buildRequest(input)
    const body = request.body as Record<string, unknown>

    expect(body.style).toEqual({ style_type: '漫画', style_weight: 0.8 })
  })

  it('passes aspect_ratio for image-01-live without size', async () => {
    const input: UnifiedRunInput = {
      providerId: 'minimax',
      modelId: 'image-01-live',
      auth: { apiKey: 'test-key' },
      operation: {
        kind: 'generate',
        prompt: 'test',
        aspectRatio: '16:9',
      },
    }

    const request = await minimaxAdaptor.buildRequest(input)
    const body = request.body as Record<string, unknown>

    expect(body.aspect_ratio).toBe('16:9')
    expect(body.width).toBeUndefined()
    expect(body.height).toBeUndefined()
  })
})
