import type { ImageProviderAdaptor } from '../domain'

export interface AdaptorRegistry {
  list(): ImageProviderAdaptor[]
  get(providerId: string): ImageProviderAdaptor | undefined
}

export function createAdaptorRegistry(adaptors: ImageProviderAdaptor[]): AdaptorRegistry {
  const adaptorMap = new Map(adaptors.map((adaptor) => [adaptor.manifest.id, adaptor]))

  return {
    list() {
      return adaptors
    },
    get(providerId: string) {
      return adaptorMap.get(providerId)
    },
  }
}
