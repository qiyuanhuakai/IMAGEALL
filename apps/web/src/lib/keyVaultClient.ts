const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export interface KeyRegistrationResult {
  ok: boolean
  keyRef?: string
  providerId?: string
  createdAt?: string
  message?: string
}

export interface KeyListItem {
  keyRef: string
  providerId: string
  label?: string
  createdAt: string
  lastUsedAt?: string
}

export async function registerKey(providerId: string, apiKey: string): Promise<KeyRegistrationResult> {
  const response = await fetch(`${API_BASE_URL}/api/keys/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ providerId, apiKey }),
  })
  return response.json() as Promise<KeyRegistrationResult>
}

export async function removeKey(keyRef: string): Promise<boolean> {
  const response = await fetch(`${API_BASE_URL}/api/keys/${keyRef}`, {
    method: 'DELETE',
  })
  const data = await response.json() as { ok: boolean }
  return data.ok
}

export async function listVaultKeys(): Promise<KeyListItem[]> {
  const response = await fetch(`${API_BASE_URL}/api/keys`)
  const data = await response.json() as { ok: boolean; keys: KeyListItem[] }
  return data.keys
}
