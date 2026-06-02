import { describe, it, expect } from 'bun:test'
import {
  generateEncryptionKey,
  encryptAesGcm,
  decryptAesGcm,
  deriveKeyFromPassword,
  generateRandomBytes,
  base64urlEncode,
  base64urlDecode,
} from './crypto'

describe('crypto', () => {
  describe('AES-256-GCM encryption', () => {
    it('roundtrips plaintext through encrypt and decrypt', async () => {
      const key = await generateEncryptionKey()
      const plaintext = 'sk-test-api-key-12345'
      const encrypted = await encryptAesGcm(key, plaintext)
      const decrypted = await decryptAesGcm(key, encrypted)
      expect(decrypted).toBe(plaintext)
    })

    it('produces different ciphertext for same plaintext (random IV)', async () => {
      const key = await generateEncryptionKey()
      const a = await encryptAesGcm(key, 'same-plaintext')
      const b = await encryptAesGcm(key, 'same-plaintext')
      expect(a.ciphertext).not.toBe(b.ciphertext)
      expect(a.iv).not.toBe(b.iv)
    })

    it('handles empty plaintext', async () => {
      const key = await generateEncryptionKey()
      const encrypted = await encryptAesGcm(key, '')
      const decrypted = await decryptAesGcm(key, encrypted)
      expect(decrypted).toBe('')
    })

    it('handles unicode plaintext', async () => {
      const key = await generateEncryptionKey()
      const plaintext = '密钥-🔑-テスト'
      const encrypted = await encryptAesGcm(key, plaintext)
      const decrypted = await decryptAesGcm(key, encrypted)
      expect(decrypted).toBe(plaintext)
    })

    it('handles long plaintext', async () => {
      const key = await generateEncryptionKey()
      const plaintext = 'x'.repeat(10_000)
      const encrypted = await encryptAesGcm(key, plaintext)
      const decrypted = await decryptAesGcm(key, encrypted)
      expect(decrypted).toBe(plaintext)
    })

    it('fails to decrypt with wrong key', async () => {
      const key1 = await generateEncryptionKey()
      const key2 = await generateEncryptionKey()
      const encrypted = await encryptAesGcm(key1, 'secret')
      await expect(decryptAesGcm(key2, encrypted)).rejects.toThrow()
    })

    it('fails to decrypt with tampered ciphertext', async () => {
      const key = await generateEncryptionKey()
      const encrypted = await encryptAesGcm(key, 'secret')
      encrypted.ciphertext = encrypted.ciphertext.slice(0, -4) + 'XXXX'
      await expect(decryptAesGcm(key, encrypted)).rejects.toThrow()
    })
  })

  describe('PBKDF2 key derivation', () => {
    it('derives same key from same password and salt', async () => {
      const salt = generateRandomBytes(16)
      const key1 = await deriveKeyFromPassword('password123', salt)
      const key2 = await deriveKeyFromPassword('password123', salt)

      const encrypted = await encryptAesGcm(key1, 'test')
      const decrypted = await decryptAesGcm(key2, encrypted)
      expect(decrypted).toBe('test')
    })

    it('derives different key from different salt', async () => {
      const salt1 = generateRandomBytes(16)
      const salt2 = generateRandomBytes(16)
      const key1 = await deriveKeyFromPassword('password', salt1)
      const key2 = await deriveKeyFromPassword('password', salt2)

      const encrypted = await encryptAesGcm(key1, 'test')
      await expect(decryptAesGcm(key2, encrypted)).rejects.toThrow()
    })

    it('derives different key from different password', async () => {
      const salt = generateRandomBytes(16)
      const key1 = await deriveKeyFromPassword('password1', salt)
      const key2 = await deriveKeyFromPassword('password2', salt)

      const encrypted = await encryptAesGcm(key1, 'test')
      await expect(decryptAesGcm(key2, encrypted)).rejects.toThrow()
    })
  })

  describe('base64url encoding', () => {
    it('roundtrips random bytes', () => {
      const original = generateRandomBytes(32)
      const encoded = base64urlEncode(original.buffer)
      const decoded = base64urlDecode(encoded)
      expect(decoded).toEqual(original)
    })

    it('produces URL-safe output (no +, /, or =)', () => {
      for (let i = 0; i < 100; i++) {
        const bytes = generateRandomBytes(48)
        const encoded = base64urlEncode(bytes.buffer)
        expect(encoded).not.toContain('+')
        expect(encoded).not.toContain('/')
        expect(encoded).not.toContain('=')
      }
    })

    it('handles empty buffer', () => {
      const encoded = base64urlEncode(new ArrayBuffer(0))
      expect(encoded).toBe('')
      const decoded = base64urlDecode(encoded)
      expect(decoded.length).toBe(0)
    })
  })

  describe('generateRandomBytes', () => {
    it('returns correct length', () => {
      expect(generateRandomBytes(12).length).toBe(12)
      expect(generateRandomBytes(32).length).toBe(32)
    })

    it('produces different output each time', () => {
      const a = generateRandomBytes(32)
      const b = generateRandomBytes(32)
      expect(a).not.toEqual(b)
    })
  })
})
