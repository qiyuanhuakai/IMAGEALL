/**
 * AES-256-GCM encryption utilities using Web Crypto API.
 * Works in both browser (SubtleCrypto) and Bun (crypto.webcrypto).
 */

export interface EncryptedPayload {
  /** Initialization vector, base64url-encoded (12 bytes) */
  iv: string
  /** Ciphertext + auth tag, base64url-encoded */
  ciphertext: string
}

export interface EncryptedKeyStore {
  /** Schema version for migration */
  version: number
  /** Map of providerId → encrypted payload */
  keys: Record<string, EncryptedPayload>
}

/**
 * Generate a new AES-256-GCM key.
 * @param extractable - Whether the key can be exported. Default false for security.
 */
export async function generateEncryptionKey(extractable = false): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    extractable,
    ['encrypt', 'decrypt'],
  )
}

/**
 * Encrypt plaintext using AES-256-GCM with a random 12-byte IV.
 * Returns base64url-encoded IV and ciphertext.
 */
export async function encryptAesGcm(key: CryptoKey, plaintext: string): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(plaintext)

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded,
  )

  return {
    iv: base64urlEncode(iv.buffer),
    ciphertext: base64urlEncode(ciphertext),
  }
}

/**
 * Decrypt an AES-256-GCM encrypted payload.
 */
export async function decryptAesGcm(key: CryptoKey, payload: EncryptedPayload): Promise<string> {
  const iv = base64urlDecode(payload.iv)
  const ciphertext = base64urlDecode(payload.ciphertext)

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    ciphertext as unknown as BufferSource,
  )

  return new TextDecoder().decode(decrypted)
}

/**
 * Derive an AES-256-GCM key from a password using PBKDF2.
 * @param password - User password or passphrase
 * @param salt - Random salt (at least 16 bytes)
 * @param iterations - PBKDF2 iterations. OWASP recommends 200,000+ for SHA-256.
 */
export async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array,
  iterations = 200_000,
): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/**
 * Generate cryptographically secure random bytes.
 */
export function generateRandomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length))
}

/**
 * Encode an ArrayBuffer as base64url (URL-safe, no padding).
 */
export function base64urlEncode(buffer: ArrayBufferLike): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Decode a base64url string to Uint8Array.
 */
export function base64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}
