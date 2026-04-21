const ACCESS_TOKEN_KEY = "ai_dev_access_token";
const USER_KEY = "ai_dev_user";

export function getStoredAccessToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return localStorage.getItem(ACCESS_TOKEN_KEY);
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

export function clearStoredSession(): void {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
