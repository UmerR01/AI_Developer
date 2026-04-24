const ACCESS_TOKEN_KEY = "ai_dev_access_token";
const USER_KEY = "ai_dev_user";
const LEGACY_ACCESS_TOKEN_KEYS = ["access_token", "token", "jwt", "auth_token"];

export interface StoredUser {
  id?: string | null;
  username?: string | null;
  email?: string | null;
}

function normalizeToken(raw: string | null): string | null {
  if (!raw) {
    return null;
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const unquoted =
    (trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))
      ? trimmed.slice(1, -1).trim()
      : trimmed;

  if (unquoted.toLowerCase().startsWith("bearer ")) {
    const bearerValue = unquoted.split(" ", 2)[1]?.trim() || null;
    if (!bearerValue) {
      return null;
    }
    if (["null", "undefined", "[object object]", "nan"].includes(bearerValue.toLowerCase())) {
      return null;
    }
    return bearerValue;
  }

  if (["null", "undefined", "[object object]", "nan"].includes(unquoted.toLowerCase())) {
    return null;
  }

  return unquoted;
}

export function getStoredAccessToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const current = normalizeToken(localStorage.getItem(ACCESS_TOKEN_KEY));
  if (current) {
    return current;
  }

  const sessionCurrent = normalizeToken(sessionStorage.getItem(ACCESS_TOKEN_KEY));
  if (sessionCurrent) {
    localStorage.setItem(ACCESS_TOKEN_KEY, sessionCurrent);
    return sessionCurrent;
  }

  for (const key of LEGACY_ACCESS_TOKEN_KEYS) {
    const value = normalizeToken(localStorage.getItem(key));
    if (value) {
      localStorage.setItem(ACCESS_TOKEN_KEY, value);
      return value;
    }

    const sessionValue = normalizeToken(sessionStorage.getItem(key));
    if (sessionValue) {
      localStorage.setItem(ACCESS_TOKEN_KEY, sessionValue);
      return sessionValue;
    }
  }

  return null;
}

export function getStoredUsername(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = localStorage.getItem(USER_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as { username?: string | null };
    return parsed.username ? parsed.username.toLowerCase() : null;
  } catch {
    return null;
  }
}

export function getStoredUser(): StoredUser | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = localStorage.getItem(USER_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as StoredUser | null;
    return parsed;
  } catch {
    return null;
  }
}

export function setStoredSession(accessToken: string, user: StoredUser | null): void {
  if (typeof window === "undefined") {
    return;
  }

  const normalized = normalizeToken(accessToken);
  if (!normalized) {
    return;
  }

  localStorage.setItem(ACCESS_TOKEN_KEY, normalized);
  localStorage.setItem(USER_KEY, JSON.stringify(user || null));
}

export function clearStoredSession(): void {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
