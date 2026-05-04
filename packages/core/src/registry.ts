import type { OperationKind, ProviderManifest, ProviderModelManifest, ProviderOptionDefinition } from './domain'

export interface ProviderRegistry {
  listProviders(): ProviderManifest[]
  getProviderById(providerId: string): ProviderManifest | undefined
  getModelById(providerId: string, modelId: string): ProviderModelManifest | undefined
  getProviderOptions(providerId: string, modelId?: string, operationKind?: OperationKind): ProviderOptionDefinition[]
}

export function createProviderRegistry(providers: ProviderManifest[]): ProviderRegistry {
  return {
    listProviders() {
      return providers
    },
    getProviderById(providerId) {
      return providers.find((provider) => provider.id === providerId)
    },
    getModelById(providerId, modelId) {
      return providers
        .find((provider) => provider.id === providerId)
        ?.models.find((model) => model.id === modelId)
    },
    getProviderOptions(providerId, modelId, operationKind) {
      const provider = providers.find((entry) => entry.id === providerId)
      if (!provider) {
        return []
      }

      return getProviderOptions(provider, modelId, operationKind)
    },
  }
}

export function getProviderOptions(provider: ProviderManifest, modelId?: string, operationKind?: OperationKind): ProviderOptionDefinition[] {
  return provider.providerOptions.filter((option) => {
    if (option.appliesToModels && option.appliesToModels.length > 0) {
      if (!modelId || !option.appliesToModels.includes(modelId)) {
        return false
      }
    }

    if (option.appliesToOperations && option.appliesToOperations.length > 0) {
      if (!operationKind || !option.appliesToOperations.includes(operationKind)) {
        return false
      }
    }

    return true
  })
}
