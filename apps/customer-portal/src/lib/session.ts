export type CustomerMode = "guest" | "account";

export interface CustomerSession {
  mode: CustomerMode;
  name?: string;
  email?: string;
  entityId?: string;
}

const KEY = "cx_session";

export function getSession(): CustomerSession {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return { mode: "guest" };
    return JSON.parse(raw) as CustomerSession;
  } catch {
    return { mode: "guest" };
  }
}

export function setSession(session: CustomerSession) {
  sessionStorage.setItem(KEY, JSON.stringify(session));
}

export function clearSession() {
  sessionStorage.removeItem(KEY);
}

export function isAccountUser(): boolean {
  return getSession().mode === "account";
}
