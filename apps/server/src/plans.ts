import type {
  PreparedRunPlan,
  ProviderRequest,
  ProviderRequestPreview,
  UnifiedRunInput,
} from '@imageall/core'

const EXECUTION_PLAN_TTL_MS = 10 * 60 * 1000

interface StoredExecutionPlan {
  plan: PreparedRunPlan
  input: UnifiedRunInput
}

const executionPlanStore = new Map<string, StoredExecutionPlan>()

function cleanupExpiredPlans(now = Date.now()) {
  for (const [planId, record] of executionPlanStore.entries()) {
    if (Date.parse(record.plan.expiresAt) <= now) {
      executionPlanStore.delete(planId)
    }
  }
}

function sanitizeHeaders(headers?: Record<string, string>): Record<string, string> | undefined {
  if (!headers) {
    return undefined
  }

  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => {
      if (key.toLowerCase() === 'authorization') {
        return [key, 'Bearer [redacted]']
      }

      return [key, value]
    }),
  )
}

function summarizeBodyValue(value: unknown): unknown {
  if (typeof value === 'string') {
    if (value.startsWith('data:')) {
      return '[data-url image payload]'
    }

    if (value.length > 240) {
      return `[large string:${value.length}]`
    }

    return value
  }

  if (Array.isArray(value)) {
    return value.map((entry) => summarizeBodyValue(entry))
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, summarizeBodyValue(entry)]),
    )
  }

  return value
}

function summarizeRequestBody(body: ProviderRequest['body']): unknown {
  if (body instanceof FormData) {
    return Object.fromEntries(
      Array.from(body.entries()).map(([key, value]) => {
        if (typeof value === 'string') {
          return [key, summarizeBodyValue(value)]
        }

        const fileValue = value as Blob
        return [key, `[binary payload:${fileValue.type || 'application/octet-stream'}]`]
      }),
    )
  }

  return summarizeBodyValue(body)
}

function createRequestPreview(request: ProviderRequest): ProviderRequestPreview {
  const sanitizedHeaders = sanitizeHeaders(request.headers)

  return {
    url: request.url,
    method: request.method,
    bodyType: request.bodyType,
    ...(sanitizedHeaders ? { headers: sanitizedHeaders } : {}),
    bodySummary: summarizeRequestBody(request.body),
  }
}

function toCanonicalInput(input: UnifiedRunInput): UnifiedRunInput {
  return structuredClone({
    ...input,
    auth: {},
  })
}

export function createExecutionPlan(input: UnifiedRunInput, request: ProviderRequest): PreparedRunPlan {
  cleanupExpiredPlans()

  const createdAt = new Date().toISOString()
  const expiresAt = new Date(Date.now() + EXECUTION_PLAN_TTL_MS).toISOString()

  const plan: PreparedRunPlan = {
    id: crypto.randomUUID(),
    providerId: input.providerId,
    modelId: input.modelId,
    operationKind: input.operation.kind,
    createdAt,
    expiresAt,
    requestPreview: createRequestPreview(request),
  }

  executionPlanStore.set(plan.id, {
    plan,
    input: toCanonicalInput(input),
  })

  return plan
}

export function takeExecutionPlan(planId: string): StoredExecutionPlan | undefined {
  cleanupExpiredPlans()

  const record = executionPlanStore.get(planId)
  if (!record) {
    return undefined
  }

  executionPlanStore.delete(planId)
  return record
}

export function peekExecutionPlan(planId: string): StoredExecutionPlan | undefined {
  cleanupExpiredPlans()
  return executionPlanStore.get(planId)
}
