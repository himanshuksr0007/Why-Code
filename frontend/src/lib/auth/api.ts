/**
 * Client for the backend auth API (/api/v1/auth).
 *
 * In HTTP mode this talks to the real service: accounts in Neo4j,
 * passwords Argon2id-hashed server-side, verification codes mailed
 * through Gmail SMTP. In mock mode (the offline demo build) the same
 * contract is simulated locally so the flow can be walked end to end —
 * no email leaves the browser, and the signup call surfaces the code
 * as `demo_code` for the verify screen to display.
 */

import { API_BASE_URL, API_MODE } from "@/lib/api/config";
import {
  clearAuthSession,
  getAuthSession,
  setAuthSession,
  type AuthSession,
  type AuthUser,
} from "@/lib/auth/store";

export class AuthApiError extends Error {
  status: number;
  code: string;
  retryAfter: number;

  constructor(status: number, detail: string, code = "", retryAfter = 0) {
    super(detail);
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

export interface SignupResult {
  email: string;
  /** Mock mode only: the code that would have been emailed. */
  demo_code?: string;
}

async function request<T>(
  path: string,
  init?: RequestInit & { auth?: boolean },
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (init?.auth) {
    const session = getAuthSession();
    if (session) headers.Authorization = `Bearer ${session.token}`;
  }
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  } catch {
    throw new AuthApiError(0, "Could not reach the server. Check your connection and try again.");
  }
  if (response.status === 204) return undefined as T;
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new AuthApiError(
      response.status,
      typeof payload.detail === "string" ? payload.detail : "Something went wrong.",
      typeof payload.code === "string" ? payload.code : "",
      Number(response.headers.get("Retry-After") ?? 0) || 0,
    );
  }
  return payload as T;
}

/* ------------------------------------------------------------------ */
/* Mock-mode simulation (offline demo only)                            */
/* ------------------------------------------------------------------ */

interface MockUser {
  name: string;
  email: string;
  password_hash: string;
  email_verified: boolean;
  created_at: string;
}

const MOCK_USERS_KEY = "whycode:mock-users.v1";
const MOCK_OTP_KEY = "whycode:mock-otp.v1";

function mockUsers(): Record<string, MockUser> {
  try {
    return JSON.parse(window.localStorage.getItem(MOCK_USERS_KEY) ?? "{}") as Record<
      string,
      MockUser
    >;
  } catch {
    return {};
  }
}

function saveMockUsers(users: Record<string, MockUser>): void {
  window.localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(users));
}

async function mockHash(password: string, email: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`whycode-mock:${email}:${password}`),
  );
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function mockSessionFor(user: MockUser): AuthSession {
  const session: AuthSession = {
    token: `mock-${Math.random().toString(36).slice(2)}`,
    user: {
      id: `mock-${user.email}`,
      name: user.name,
      email: user.email,
      email_verified: user.email_verified,
      created_at: user.created_at,
    },
  };
  setAuthSession(session);
  return session;
}

const mockApi = {
  async signup(name: string, email: string, password: string): Promise<SignupResult> {
    const normalized = email.trim().toLowerCase();
    const users = mockUsers();
    const existing = users[normalized];
    if (existing?.email_verified) {
      throw new AuthApiError(409, "An account with this email already exists. Log in instead.", "account_exists");
    }
    users[normalized] = {
      name,
      email: normalized,
      password_hash: await mockHash(password, normalized),
      email_verified: false,
      created_at: existing?.created_at ?? new Date().toISOString(),
    };
    saveMockUsers(users);
    const code = String(Math.floor(100000 + Math.random() * 900000));
    window.sessionStorage.setItem(
      MOCK_OTP_KEY,
      JSON.stringify({ email: normalized, code, expires: Date.now() + 10 * 60_000, attempts: 0 }),
    );
    return { email: normalized, demo_code: code };
  },

  async verifyEmail(email: string, code: string): Promise<AuthSession> {
    const normalized = email.trim().toLowerCase();
    const raw = window.sessionStorage.getItem(MOCK_OTP_KEY);
    const pending = raw ? (JSON.parse(raw) as { email: string; code: string; expires: number }) : null;
    if (!pending || pending.email !== normalized) {
      throw new AuthApiError(400, "No verification is pending for this email. Sign up or ask for a new code.", "no_pending_code");
    }
    if (pending.expires < Date.now()) {
      throw new AuthApiError(400, "That code has expired. Ask for a new one.", "code_expired");
    }
    if (pending.code !== code.trim()) {
      throw new AuthApiError(400, "That code does not match.", "code_mismatch");
    }
    const users = mockUsers();
    const user = users[normalized];
    if (!user) throw new AuthApiError(400, "No account is waiting for this code.", "no_account");
    user.email_verified = true;
    saveMockUsers(users);
    window.sessionStorage.removeItem(MOCK_OTP_KEY);
    return mockSessionFor(user);
  },

  async resendOtp(email: string): Promise<SignupResult> {
    const normalized = email.trim().toLowerCase();
    const users = mockUsers();
    if (!users[normalized] || users[normalized].email_verified) {
      return { email: normalized };
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    window.sessionStorage.setItem(
      MOCK_OTP_KEY,
      JSON.stringify({ email: normalized, code, expires: Date.now() + 10 * 60_000, attempts: 0 }),
    );
    return { email: normalized, demo_code: code };
  },

  async login(email: string, password: string): Promise<AuthSession> {
    const normalized = email.trim().toLowerCase();
    const user = mockUsers()[normalized];
    if (!user || user.password_hash !== (await mockHash(password, normalized))) {
      throw new AuthApiError(401, "Invalid email or password.", "invalid_credentials");
    }
    if (!user.email_verified) {
      throw new AuthApiError(403, "Verify your email first — enter the code we sent you.", "email_not_verified");
    }
    return mockSessionFor(user);
  },
};

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export const authApi = {
  async signup(name: string, email: string, password: string): Promise<SignupResult> {
    if (API_MODE === "mock") return mockApi.signup(name, email, password);
    return request<SignupResult>("/api/v1/auth/signup", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
  },

  async verifyEmail(email: string, code: string): Promise<AuthSession> {
    if (API_MODE === "mock") return mockApi.verifyEmail(email, code);
    const session = await request<AuthSession>("/api/v1/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ email, code }),
    });
    setAuthSession(session);
    return session;
  },

  async resendOtp(email: string): Promise<SignupResult> {
    if (API_MODE === "mock") return mockApi.resendOtp(email);
    return request<SignupResult>("/api/v1/auth/resend-otp", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },

  async login(email: string, password: string): Promise<AuthSession> {
    if (API_MODE === "mock") return mockApi.login(email, password);
    const session = await request<AuthSession>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setAuthSession(session);
    return session;
  },

  async logout(): Promise<void> {
    if (API_MODE === "http") {
      await request<void>("/api/v1/auth/logout", { method: "POST", auth: true }).catch(
        () => undefined,
      );
    }
    clearAuthSession();
  },

  /** Validate the stored token against the server; drop it if dead. */
  async syncSession(): Promise<void> {
    const session = getAuthSession();
    if (!session || API_MODE === "mock") return;
    try {
      const { user } = await request<{ user: AuthUser }>("/api/v1/auth/me", { auth: true });
      setAuthSession({ token: session.token, user });
    } catch (error) {
      if (error instanceof AuthApiError && error.status === 401) {
        clearAuthSession();
      }
    }
  },
};
