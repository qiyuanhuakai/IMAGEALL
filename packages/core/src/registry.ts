import type { ProviderManifest, ProviderModelManifest, ProviderOptionDefinition } from './domain'

export interface ProviderRegistry {
  listProviders(): ProviderManifest[]
  getProviderById(providerId: string): ProviderManifest | undefined
  getModelById(providerId: string, modelId: string): ProviderModelManifest | undefined
  getProviderOptions(providerId: string, modelId?: string): ProviderOptionDefinition[]
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
    getProviderOptions(providerId, modelId) {
      const provider = providers.find((entry) => entry.id === providerId)
      if (!provider) {
        return []
      }

      return provider.providerOptions.filter((option) => {
        if (!option.appliesToModels || option.appliesToModels.length === 0) {
          return true
        }

        if (!modelId) {
          return false
        }

        return option.appliesToModels.includes(modelId)
      })
    },
  }
}

export function getProviderOptions(provider: ProviderManifest, modelId?: string): ProviderOptionDefinition[] {
  return provider.providerOptions.filter((option) => {
    if (!option.appliesToModels || option.appliesToModels.length === 0) {
      return true
    }

    if (!modelId) {
      return false
    }

    return option.appliesToModels.includes(modelId)
  })
}
