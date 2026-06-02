import {
  generateEncryptionKey,
  encryptAesGcm,
  decryptAesGcm,
  type EncryptedPayload,
  type EncryptedKeyStore,
} from '@imageall/core'

const DB_NAME = 'imageall-crypto'
const STORE_NAME = 'keys'
const DEVICE_KEY_NAME = 'device-encryption-key'
const LS_ENCRYPTED_KEYS = 'imageall_provider_keys_encrypted'
const LS_LEGACY_KEYS = 'imageall_provider_keys'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function dbGet<T>(name: string): Promise<T | null> {
  return new Promise(async (resolve, reject) => {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(name)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => reject(req.error)
  })
}

function dbPut<T>(name: string, value: T): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const req = tx.objectStore(STORE_NAME).put(value, name)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

let cachedDeviceKey: CryptoKey | null = null

export async function getDeviceKey(): Promise<CryptoKey> {
  if (cachedDeviceKey) return cachedDeviceKey

  const stored = await dbGet<CryptoKey>(DEVICE_KEY_NAME)
  if (stored) {
    cachedDeviceKey = stored
    return stored
  }

  const key = await generateEncryptionKey(false)
  await dbPut(DEVICE_KEY_NAME, key)
  cachedDeviceKey = key
  return key
}

export async function saveProviderKeys(keys: Record<string, string>): Promise<void> {
  const deviceKey = await getDeviceKey()
  const encryptedKeys: Record<string, EncryptedPayload> = {}

  for (const [providerId, apiKey] of Object.entries(keys)) {
    const trimmed = apiKey.trim()
    if (trimmed) {
      encryptedKeys[providerId] = await encryptAesGcm(deviceKey, trimmed)
    }
  }

  const store: EncryptedKeyStore = { version: 1, keys: encryptedKeys }
  localStorage.setItem(LS_ENCRYPTED_KEYS, JSON.stringify(store))
}

export async function loadProviderKeys(): Promise<Record<string, string>> {
  const deviceKey = await getDeviceKey()

  const raw = localStorage.getItem(LS_ENCRYPTED_KEYS)
  if (raw) {
    try {
      const store = JSON.parse(raw) as EncryptedKeyStore
      const result: Record<string, string> = {}

      for (const [providerId, payload] of Object.entries(store.keys)) {
        try {
          result[providerId] = await decryptAesGcm(deviceKey, payload)
        } catch {
          console.warn(`[secureStorage] Failed to decrypt key for ${providerId}, skipping`)
        }
      }

      return result
    } catch {
      console.warn('[secureStorage] Failed to parse encrypted store, attempting migration')
    }
  }

  return migrateFromPlaintext(deviceKey)
}

async function migrateFromPlaintext(deviceKey: CryptoKey): Promise<Record<string, string>> {
  const plaintext = localStorage.getItem(LS_LEGACY_KEYS)
  if (!plaintext) return {}

  try {
    const keys = JSON.parse(plaintext) as Record<string, string>
    if (typeof keys !== 'object' || keys === null) return {}

    const encryptedKeys: Record<string, EncryptedPayload> = {}
    for (const [providerId, apiKey] of Object.entries(keys)) {
      if (typeof apiKey === 'string' && apiKey.trim()) {
        encryptedKeys[providerId] = await encryptAesGcm(deviceKey, apiKey.trim())
      }
    }

    const store: EncryptedKeyStore = { version: 1, keys: encryptedKeys }
    localStorage.setItem(LS_ENCRYPTED_KEYS, JSON.stringify(store))
    localStorage.removeItem(LS_LEGACY_KEYS)
    console.info('[secureStorage] Migrated provider keys from plaintext to encrypted storage')

    return keys
  } catch {
    return {}
  }
}

export function isSecureStorageAvailable(): boolean {
  return typeof crypto !== 'undefined'
    && typeof crypto.subtle !== 'undefined'
    && typeof indexedDB !== 'undefined'
}
