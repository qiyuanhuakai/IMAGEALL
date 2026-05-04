import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto'
import type { KeyReference } from '@imageall/core'

interface VaultEntry {
  keyRef: string
  providerId: string
  encryptedKey: string
  iv: string
  authTag: string
  createdAt: string
  lastUsedAt?: string
}

const vault = new Map<string, VaultEntry>()

let cachedVaultKey: Buffer | null = null

function getVaultKey(): Buffer {
  if (cachedVaultKey) return cachedVaultKey

  const envKey = Bun.env.IMAGEALL_VAULT_KEY
  if (envKey && envKey.length >= 64) {
    cachedVaultKey = Buffer.from(envKey, 'hex')
    return cachedVaultKey
  }
  if (!getVaultKey._warned) {
    console.warn('[keyVault] IMAGEALL_VAULT_KEY not set — using ephemeral key. Keys will be lost on restart.')
    getVaultKey._warned = true
  }
  cachedVaultKey = randomBytes(32)
  return cachedVaultKey
}
getVaultKey._warned = false

function encryptKey(plaintext: string): { encrypted: string; iv: string; authTag: string } {
  const key = getVaultKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)

  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag().toString('hex')

  return { encrypted, iv: iv.toString('hex'), authTag }
}

function decryptKey(encrypted: string, iv: string, authTag: string): string {
  const key = getVaultKey()
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'))
  decipher.setAuthTag(Buffer.from(authTag, 'hex'))

  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

export function storeApiKey(providerId: string, apiKey: string): KeyReference {
  const { encrypted, iv, authTag } = encryptKey(apiKey)
  const keyRef = `vault-${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`

  const entry: VaultEntry = {
    keyRef,
    providerId,
    encryptedKey: encrypted,
    iv,
    authTag,
    createdAt: new Date().toISOString(),
  }

  vault.set(keyRef, entry)

  return {
    keyRef,
    providerId,
    createdAt: entry.createdAt,
  }
}

export function resolveApiKey(keyRef: string): string | undefined {
  const entry = vault.get(keyRef)
  if (!entry) return undefined

  entry.lastUsedAt = new Date().toISOString()
  return decryptKey(entry.encryptedKey, entry.iv, entry.authTag)
}

export function removeApiKey(keyRef: string): boolean {
  return vault.delete(keyRef)
}

export function listKeys(): KeyReference[] {
  return Array.from(vault.values()).map((entry) => ({
    keyRef: entry.keyRef,
    providerId: entry.providerId,
    createdAt: entry.createdAt,
    ...(entry.lastUsedAt ? { lastUsedAt: entry.lastUsedAt } : {}),
  }))
}

export function clearVault(): void {
  vault.clear()
}
