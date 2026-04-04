const TOKEN_KEY = "auth_token";
const USER_ID_KEY = "auth_user_id";
const USERNAME_KEY = "auth_username";
export const AUTH_EVENT = "auth-changed";

export type AuthUser = { id: string; username: string };

export function getToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY);
  return token && token.trim().length > 0 ? token : null;
}

export function getAuthUser(): AuthUser | null {
  const id = localStorage.getItem(USER_ID_KEY);
  const username = localStorage.getItem(USERNAME_KEY);
  if (!id || !username) return null;
  return { id, username };
}

export function setAuthSession(token: string, user: AuthUser): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_ID_KEY, user.id);
  localStorage.setItem(USERNAME_KEY, user.username);
  window.dispatchEvent(new Event(AUTH_EVENT));
}

export function clearAuthSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_ID_KEY);
  localStorage.removeItem(USERNAME_KEY);
  window.dispatchEvent(new Event(AUTH_EVENT));
}
