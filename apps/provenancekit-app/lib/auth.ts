/**
 * Privy auth helpers for server-side usage.
 *
 * Auth flow:
 * 1. Client logs in with Privy, gets an access token
 * 2. Client calls POST /api/auth/session with the token in Authorization header
 * 3. Server verifies token with @privy-io/server-auth, sets httpOnly pk-session cookie
 * 4. Server components read privyDid from cookie; API routes verify JWT for mutations
 */

import { PrivyClient } from "@privy-io/server-auth";
import { cookies } from "next/headers";

// ─── Privy server client ──────────────────────────────────────────────────────

let _privy: PrivyClient | null = null;

export function getPrivyClient(): PrivyClient {
  if (!_privy) {
    _privy = new PrivyClient(
      process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
      process.env.PRIVY_APP_SECRET!
    );
  }
  return _privy;
}

// ─── Token verification ───────────────────────────────────────────────────────

export interface PrivyClaims {
  userId: string;  // Privy DID — e.g. "did:privy:abc123"
  appId: string;
}

/**
 * Verify a Privy access token from the Authorization header.
 * Returns the claims or throws on invalid/expired token.
 */
export async function verifyPrivyToken(token: string): Promise<PrivyClaims> {
  const privy = getPrivyClient();
  const claims = await privy.verifyAuthToken(token);
  return { userId: claims.userId, appId: claims.appId };
}

// ─── Cookie-based session (for server components) ─────────────────────────────

const SESSION_COOKIE = "pk-session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export interface SessionUser {
  privyDid: string;
}

/**
 * Read the session cookie in a server component or API route.
 * Returns null if no valid session cookie is present.
 */
export async function getServerUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SessionUser;
    if (!parsed.privyDid) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Set the session cookie after successful Privy JWT verification.
 * Called by POST /api/auth/session.
 */
export async function setSessionCookie(privyDid: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, JSON.stringify({ privyDid }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

/**
 * Clear the session cookie. Called by DELETE /api/auth/session (logout).
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

/**
 * Get the privyDid from an API route's Authorization header (Privy JWT).
 * Used for mutation API routes that need verified identity.
 * Falls back to the session cookie for dashboard API routes.
 */
export async function getAuthUser(
  authHeader: string | null
): Promise<SessionUser | null> {
  // Try Bearer JWT first (for programmatic / Privy-token requests)
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    // If it looks like a pk_live_ API key, don't try Privy verification
    if (!token.startsWith("pk_live_")) {
      try {
        const claims = await verifyPrivyToken(token);
        return { privyDid: claims.userId };
      } catch {
        // fall through to cookie
      }
    }
  }
  // Fall back to httpOnly session cookie
  return getServerUser();
}
