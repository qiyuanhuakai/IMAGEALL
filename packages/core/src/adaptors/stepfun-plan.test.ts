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
    expect(result.errors).toContain('StepFun Plan currently supports only step-image-edit-2.')
  })
})
