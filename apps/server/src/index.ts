import { cors } from '@elysiajs/cors'
import { Elysia } from 'elysia'

import {
  defaultAdaptors,
  type ExecutePreparedRunInput,
  type PreparedRunPlan,
  createAdaptorRegistry,
  createDemoBootstrap,
  createProviderRegistry,
  type UnifiedRunInput,
} from '@imageall/core'

import { createExecutionPlan, takeExecutionPlan } from './plans'

const port = Number(Bun.env.IMAGEALL_PORT ?? 3001)
const bootstrap = createDemoBootstrap()
const providerRegistry = createProviderRegistry(bootstrap.providers)
const adaptorRegistry = createAdaptorRegistry(defaultAdaptors)

const app = new Elysia({ prefix: '/api' })
  .use(
    cors({
      origin: true,
    }),
  )
  .get('/health', () => ({
    ok: true,
    service: 'imageall-server',
    timestamp: new Date().toISOString(),
  }))
  .get('/bootstrap', () => bootstrap)
  .get('/providers', () => bootstrap.providers)
  .get('/providers/:providerId/models', ({ params, set }) => {
    const provider = providerRegistry.getProviderById(params.providerId)

    if (!provider) {
      set.status = 404
      return {
        ok: false,
        message: `Unknown provider: ${params.providerId}`,
      }
    }

    return {
      ok: true,
      models: provider.models,
    }
  })
  .get('/workspaces', () => {
    return bootstrap.workspaces
  })
  .post('/runs/validate', ({ body, set }) => {
    const input = body as UnifiedRunInput
    const adaptor = adaptorRegistry.get(input.providerId)

    if (!adaptor) {
      set.status = 404
      return {
        ok: false,
        message: `Unknown adaptor: ${input.providerId}`,
      }
    }

    return adaptor.validateOperation(input)
  })
  .post('/runs/prepare', async ({ body, set }) => {
    const input = body as UnifiedRunInput
    const adaptor = adaptorRegistry.get(input.providerId)

    if (!adaptor) {
      set.status = 404
      return {
        ok: false,
        message: `Unknown adaptor: ${input.providerId}`,
      }
    }

    try {
      const request = await adaptor.buildRequest(input)
      const plan = createExecutionPlan(input, request)

      return {
        ok: true,
        plan,
      }
    } catch (error) {
      set.status = 400
      return {
        ok: false,
        error: adaptor.normalizeError(error),
      }
    }
  })
  .post('/runs/execute', async ({ body, set }) => {
    const payload = body as UnifiedRunInput | ExecutePreparedRunInput

    if ('planId' in payload) {
      const storedPlan = takeExecutionPlan(payload.planId)

      if (!storedPlan) {
        set.status = 404
        return {
          ok: false,
          message: `Unknown or expired execution plan: ${payload.planId}`,
        }
      }

      const input = storedPlan.input
      const adaptor = adaptorRegistry.get(input.providerId)

      if (!adaptor) {
        set.status = 404
        return {
          ok: false,
          message: `Unknown adaptor: ${input.providerId}`,
        }
      }

      const provider = providerRegistry.getProviderById(input.providerId)
      const envKey = provider?.auth.envKey
      const apiKey = payload.auth?.apiKey ?? (envKey ? Bun.env[envKey] : undefined)

      if (!apiKey) {
        set.status = 400
        return {
          ok: false,
          message: `Missing API key for provider ${input.providerId}.`,
        }
      }

      try {
        const result = await adaptor.execute({
          ...input,
          auth: {
            apiKey,
          },
        })

        return {
          ok: true,
          plan: storedPlan.plan satisfies PreparedRunPlan,
          result,
        }
      } catch (error) {
        set.status = 502
        return {
          ok: false,
          error: adaptor.normalizeError(error),
        }
      }
    }

    const input = payload
    const adaptor = adaptorRegistry.get(input.providerId)

    if (!adaptor) {
      set.status = 404
      return {
        ok: false,
        message: `Unknown adaptor: ${input.providerId}`,
      }
    }

    const provider = providerRegistry.getProviderById(input.providerId)
    const envKey = provider?.auth.envKey
    const apiKey = input.auth.apiKey ?? (envKey ? Bun.env[envKey] : undefined)

    if (!apiKey) {
      set.status = 400
      return {
        ok: false,
        message: `Missing API key for provider ${input.providerId}.`,
      }
    }

    try {
      const result = await adaptor.execute({
        ...input,
        auth: {
          apiKey,
        },
      })

      return {
        ok: true,
        result,
      }
    } catch (error) {
      set.status = 502
      return {
        ok: false,
        error: adaptor.normalizeError(error),
      }
    }
  })

app.listen(port)

console.log(`ImageAll server listening on http://localhost:${port}/api`)

export type App = typeof app
