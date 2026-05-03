import { cors } from '@elysiajs/cors'
import { Elysia } from 'elysia'
import { readdir, stat } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'

import {
  defaultAdaptors,
  type Artifact,
  type ExecutePreparedRunInput,
  type PreparedRunPlan,
  createAdaptorRegistry,
  createDemoBootstrap,
  createProviderRegistry,
  type UnifiedRunInput,
} from '@imageall/core'

import { createExecutionPlan, takeExecutionPlan } from './plans'
import { listArtifacts, listRuns, storeArtifact, storeRun, setWorkspaceFolder, getWorkspaceFolder } from './store'

const port = Number(Bun.env.IMAGEALL_PORT ?? 3001)
let bootstrap = createDemoBootstrap()
const providerRegistry = createProviderRegistry(bootstrap.providers)
const adaptorRegistry = createAdaptorRegistry(defaultAdaptors)

function refreshBootstrap(): void {
  bootstrap = {
    ...bootstrap,
    generatedAt: new Date().toISOString(),
    artifacts: listArtifacts(),
    runs: listRuns(),
  }
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

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
  .get('/fs/list', async ({ query, set }) => {
    const rawPath = (query.path as string) || '~'
    const homeDir = Bun.env.HOME ?? Bun.env.USERPROFILE ?? '/'
    const targetPath = resolve(rawPath.replace('~', homeDir))

    try {
      const entries = await readdir(targetPath, { withFileTypes: true })
      const items = await Promise.all(
        entries
          .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
          .map(async (e) => {
            const fullPath = join(targetPath, e.name)
            try {
              const s = await stat(fullPath)
              return { name: e.name, path: fullPath, modified: s.mtime.toISOString() }
            } catch {
              return null
            }
          }),
      )
      const dirs = items.filter(Boolean) as Array<{ name: string; path: string; modified: string }>
      dirs.sort((a, b) => a.name.localeCompare(b.name))

      return {
        ok: true,
        path: targetPath,
        parent: targetPath !== sep ? resolve(targetPath, '..') : null,
        directories: dirs,
      }
    } catch (error) {
      set.status = 400
      return { ok: false, message: `Cannot read directory: ${targetPath}` }
    }
  })
  .get('/serve/**', ({ params }) => {
    const filePath = resolve('/', (params as { '*': string })['*'])
    return Bun.file(filePath)
  })
  .post('/workspace/folder', ({ body, set }) => {
    const { path } = body as { path: string }
    if (!path) {
      set.status = 400
      return { ok: false, message: 'Path is required' }
    }
    setWorkspaceFolder(path)
    return { ok: true, path }
  })
  .get('/workspace/folder', () => {
    return { ok: true, path: getWorkspaceFolder() }
  })
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
  .get('/runs', () => {
    return { ok: true, runs: listRuns() }
  })
  .get('/runs/:runId', ({ params, set }) => {
    const run = listRuns().find((r) => r.id === params.runId)
    if (!run) {
      set.status = 404
      return { ok: false, message: `Run not found: ${params.runId}` }
    }
    return { ok: true, run }
  })
  .get('/artifacts', () => {
    return { ok: true, artifacts: listArtifacts() }
  })
  .get('/artifacts/:artifactId', ({ params, set }) => {
    const artifact = listArtifacts().find((a) => a.id === params.artifactId)
    if (!artifact) {
      set.status = 404
      return { ok: false, message: `Artifact not found: ${params.artifactId}` }
    }
    return { ok: true, artifact }
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
      const apiKey = input.auth?.apiKey ?? payload.auth?.apiKey ?? (envKey ? Bun.env[envKey] : undefined)

      if (!apiKey) {
        set.status = 400
        return {
          ok: false,
          message: `Missing API key for provider ${input.providerId}.`,
        }
      }

      const runId = generateId('run')

      storeRun({
        id: runId,
        workspaceId: 'workspace-demo',
        providerId: input.providerId,
        modelId: input.modelId,
        operation: input.operation,
        providerSnapshot: {
          adaptorVersion: '2026.05',
          resolvedParams: input.providerOptions ?? {},
        },
        status: 'running',
        createdAt: new Date().toISOString(),
        startedAt: new Date().toISOString(),
        outputArtifactIds: [],
        logs: [
          {
            timestamp: new Date().toISOString(),
            level: 'info',
            message: `Run started for ${input.providerId}/${input.modelId}.`,
          },
        ],
      })
      refreshBootstrap()

      try {
        const result = await adaptor.execute({
          ...input,
          auth: {
            apiKey,
          },
        })

        const outputArtifactIds: string[] = []
        for (const [index, output] of result.outputs.entries()) {
          const artifactId = generateId('artifact')
          const mimeType = output.mimeType ?? (output.base64 ? 'image/png' : 'image/jpeg')
          const uri = output.uri ?? (output.base64 ? `data:${mimeType};base64,${output.base64}` : '')

          if (uri) {
              const meta: Artifact['metadata'] = {
                provider: input.providerId,
                model: input.modelId,
              }
              if (output.seed !== undefined) {
                meta.seed = output.seed
              }
              if (input.operation.prompt) {
                meta.prompt = input.operation.prompt
              }
              if (input.operation.negativePrompt) {
                meta.negativePrompt = input.operation.negativePrompt
              }

              await storeArtifact({
              id: artifactId,
              workspaceId: 'workspace-demo',
              kind: input.operation.kind === 'edit' ? 'edited' : 'generated',
              title: `${input.providerId} ${input.operation.kind} ${index + 1}`,
              mimeType,
              width: output.width ?? 0,
              height: output.height ?? 0,
              uri,
              createdAt: new Date().toISOString(),
              sourceRunId: runId,
              metadata: meta,
            })
            outputArtifactIds.push(artifactId)
          }
        }

        storeRun({
          id: runId,
          workspaceId: 'workspace-demo',
          providerId: input.providerId,
          modelId: input.modelId,
          operation: input.operation,
          providerSnapshot: {
            adaptorVersion: '2026.05',
            resolvedParams: input.providerOptions ?? {},
          },
          status: 'succeeded',
          createdAt: new Date().toISOString(),
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          outputArtifactIds,
          logs: [
            {
              timestamp: new Date().toISOString(),
              level: 'info',
              message: `Run completed with ${result.outputs.length} output(s).`,
            },
          ],
        })
        refreshBootstrap()

        return {
          ok: true,
          plan: storedPlan.plan satisfies PreparedRunPlan,
          result,
        }
      } catch (error) {
        storeRun({
          id: runId,
          workspaceId: 'workspace-demo',
          providerId: input.providerId,
          modelId: input.modelId,
          operation: input.operation,
          providerSnapshot: {
            adaptorVersion: '2026.05',
            resolvedParams: input.providerOptions ?? {},
          },
          status: 'failed',
          createdAt: new Date().toISOString(),
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          outputArtifactIds: [],
          logs: [
            {
              timestamp: new Date().toISOString(),
              level: 'error',
              message: error instanceof Error ? error.message : 'Run failed.',
            },
          ],
          error: {
            code: 'EXECUTION_ERROR',
            message: error instanceof Error ? error.message : 'Run failed.',
          },
        })
        refreshBootstrap()

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
