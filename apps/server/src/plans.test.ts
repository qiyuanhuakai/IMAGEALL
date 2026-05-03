import { describe, expect, it } from 'bun:test'

import type { ProviderRequest, UnifiedRunInput } from '@imageall/core'

import { createExecutionPlan, peekExecutionPlan, takeExecutionPlan } from './plans'

describe('execution plans', () => {
  it('stores canonical input without api key and returns a sanitized preview', () => {
    const input: UnifiedRunInput = {
      providerId: 'stepfun-plan',
      modelId: 'step-image-edit-2',
      auth: { apiKey: 'secret-key' },
      imageInputs: [
        {
          kind: 'data-url',
          value: 'data:image/png;base64,ZmFrZQ==',
        },
      ],
      operation: {
        kind: 'edit',
        prompt: 'Make it editorial',
        sourceArtifactId: 'artifact-1',
      },
    }

    const request: ProviderRequest = {
      url: 'https://api.stepfun.com/step_plan/v1/images/edits',
      method: 'POST',
      bodyType: 'json',
      headers: {
        Authorization: 'Bearer secret-key',
        'Content-Type': 'application/json',
      },
      body: {
        model: 'step-image-edit-2',
        image: 'data:image/png;base64,ZmFrZQ==',
      },
    }

    const plan = createExecutionPlan(input, request)
    const stored = peekExecutionPlan(plan.id)

    expect(plan.requestPreview.headers?.Authorization).toBe('Bearer [redacted]')
    expect(plan.requestPreview.bodySummary).toEqual({
      model: 'step-image-edit-2',
      image: '[data-url image payload]',
    })
    expect(stored?.input.auth).toEqual({})
  })

  it('consumes plans on execute lookup', () => {
    const input: UnifiedRunInput = {
      providerId: 'minimax',
      modelId: 'image-01',
      auth: {},
      operation: {
        kind: 'generate',
        prompt: 'A blue city study',
      },
    }

    const request: ProviderRequest = {
      url: 'https://api.minimax.io/v1/image_generation',
      method: 'POST',
      bodyType: 'json',
      body: {
        model: 'image-01',
      },
    }

    const plan = createExecutionPlan(input, request)

    expect(takeExecutionPlan(plan.id)?.plan.id).toBe(plan.id)
    expect(peekExecutionPlan(plan.id)).toBeUndefined()
  })
})
