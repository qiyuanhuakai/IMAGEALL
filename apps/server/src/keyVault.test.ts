import { describe, it, expect, beforeEach } from 'bun:test'
import { storeApiKey, resolveApiKey, removeApiKey, listKeys, clearVault } from './keyVault'

describe('keyVault', () => {
  beforeEach(() => {
    clearVault()
  })

  describe('storeApiKey', () => {
    it('returns a KeyReference with keyRef and providerId', () => {
      const ref = storeApiKey('minimax', 'sk-test-123')
      expect(ref.keyRef).toBeTruthy()
      expect(ref.providerId).toBe('minimax')
      expect(ref.createdAt).toBeTruthy()
    })

    it('generates unique keyRefs for different stores', () => {
      const ref1 = storeApiKey('minimax', 'sk-1')
      const ref2 = storeApiKey('stepfun', 'sk-2')
      expect(ref1.keyRef).not.toBe(ref2.keyRef)
    })
  })

  describe('resolveApiKey', () => {
    it('returns the original API key', () => {
      const ref = storeApiKey('minimax', 'sk-test-123')
      const resolved = resolveApiKey(ref.keyRef)
      expect(resolved).toBe('sk-test-123')
    })

    it('returns undefined for unknown keyRef', () => {
      expect(resolveApiKey('nonexistent')).toBeUndefined()
    })

    it('updates lastUsedAt on resolve', () => {
      const ref = storeApiKey('minimax', 'sk-test')
      resolveApiKey(ref.keyRef)
      const keys = listKeys()
      expect(keys.length).toBeGreaterThan(0)
      expect(keys[0]!.lastUsedAt).toBeTruthy()
    })
  })

  describe('removeApiKey', () => {
    it('removes the key from vault', () => {
      const ref = storeApiKey('minimax', 'sk-test')
      expect(removeApiKey(ref.keyRef)).toBe(true)
      expect(resolveApiKey(ref.keyRef)).toBeUndefined()
    })

    it('returns false for unknown keyRef', () => {
      expect(removeApiKey('nonexistent')).toBe(false)
    })
  })

  describe('listKeys', () => {
    it('returns stored key references without exposing keys', () => {
      storeApiKey('minimax', 'sk-1')
      storeApiKey('stepfun', 'sk-2')
      const keys = listKeys()
      expect(keys.length).toBe(2)
      for (const key of keys) {
        expect(JSON.stringify(key)).not.toContain('sk-')
      }
    })

    it('returns empty array when vault is empty', () => {
      expect(listKeys()).toEqual([])
    })
  })
})
