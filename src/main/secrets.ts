import { safeStorage } from 'electron'

// Encrypted values are tagged so we can distinguish them from legacy plaintext
// (written before encryption was added) and from a plaintext fallback when the
// OS has no secure-storage backend available.
const PREFIX = 'enc:v1:'

/**
 * Encrypt a secret for storage on disk using the OS secure-storage backend
 * (DPAPI on Windows, Keychain on macOS, libsecret on Linux). Returns the value
 * unchanged if encryption is unavailable so the app still works.
 */
export function encryptSecret(plain: string | undefined): string | undefined {
  if (!plain) return plain
  if (plain.startsWith(PREFIX)) return plain // already encrypted
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return PREFIX + safeStorage.encryptString(plain).toString('base64')
    }
  } catch {
    /* fall through to plaintext */
  }
  return plain
}

/** Decrypt a stored secret. Plaintext (untagged) values are returned as-is. */
export function decryptSecret(stored: string | undefined): string | undefined {
  if (!stored || !stored.startsWith(PREFIX)) return stored
  try {
    const buf = Buffer.from(stored.slice(PREFIX.length), 'base64')
    return safeStorage.decryptString(buf)
  } catch {
    // Undecryptable (e.g. copied to another machine/account): drop the secret.
    return undefined
  }
}
