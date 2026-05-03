import { describe, expect, it } from 'bun:test'

import { createProviderRegistry } from './registry'
import { providerManifests } from './providers'

describe('createProviderRegistry', () => {
  it('filters provider options by model when requested', () => {
    const registry = createProviderRegistry(providerManifests)
    const options = registry.getProviderOptions('stepfun', 'step-image-edit-2')

    expect(options.some((option) => option.id === 'textMode')).toBe(true)
    expect(options.some((option) => option.id === 'styleReferenceWeight')).toBe(false)
  })

  it('keeps stepfun-plan constrained to the plan model surface', () => {
    const registry = createProviderRegistry(providerManifests)
    const provider = registry.getProviderById('stepfun-plan')

    expect(provider?.models.map((model) => model.id)).toEqual(['step-image-edit-2'])
  })

  it('returns global provider options when no model filter is applied', () => {
    const registry = createProviderRegistry(providerManifests)
    const options = registry.getProviderOptions('minimax')

    expect(options.some((option) => option.id === 'promptOptimizer')).toBe(true)
    expect(options.some((option) => option.id === 'style')).toBe(false)
  })
})
