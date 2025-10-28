import { SESSION_STORAGE_KEY } from '../constants/app';
import type { StoredSession } from '../types/app';

export function readStoredSession(): StoredSession | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (
      parsed &&
      typeof parsed.token === 'string' &&
      typeof parsed.expiresAt === 'number' &&
      parsed.user &&
      typeof parsed.user.userId === 'string' &&
      typeof parsed.user.displayName === 'string' &&
      Array.isArray(parsed.user.roles) &&
      parsed.tenant &&
      typeof parsed.tenant.id === 'string' &&
      typeof parsed.tenant.name === 'string' &&
      typeof parsed.tenant.clientId === 'string'
    ) {
      return {
        token: parsed.token,
        expiresAt: parsed.expiresAt,
        tenant: {
          id: parsed.tenant.id,
          name: parsed.tenant.name,
          clientId: parsed.tenant.clientId
        },
        user: {
          userId: parsed.user.userId,
          displayName: parsed.user.displayName,
          roles: parsed.user.roles.filter((role): role is string => typeof role === 'string')
        }
      };
    }
  } catch (err) {
    console.warn('Không thể đọc phiên lưu trữ', err);
  }

  window.localStorage.removeItem(SESSION_STORAGE_KEY);
  return null;
}

export function writeStoredSession(session: StoredSession | null): void {
  if (typeof window === 'undefined') {
    return;
  }

  if (!session) {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}
