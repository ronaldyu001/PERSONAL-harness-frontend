import type { UserIdentityPort } from '../../application/identity/user_identity_port'

const DEFAULT_STORAGE_KEY = 'harness.user-id'

export class LocalStorageUserIdentityAdapter implements UserIdentityPort {
  private userId: string | undefined
  private readonly storageKey: string

  constructor(storageKey = DEFAULT_STORAGE_KEY) {
    this.storageKey = storageKey
  }

  getUserId(): string {
    if (this.userId) return this.userId

    const stored = window.localStorage.getItem(this.storageKey)?.trim()
    if (stored) {
      this.userId = stored
      return stored
    }

    const created = crypto.randomUUID()
    window.localStorage.setItem(this.storageKey, created)
    this.userId = created
    return created
  }
}
