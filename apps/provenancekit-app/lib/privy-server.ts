// lib/privy‑server.ts --------------------------------------------------------
import { PrivyClient } from "@privy-io/server-auth";

/* one client for the whole backend process */
const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID as string,
  process.env.PRIVY_APP_SECRET as string // ← set in .env.local
);

/** Verify the bearer and return the full Privy User or throw */
export async function getPrivyUser(authHeader: string | undefined) {
  /* 1. basic syntax check -------------------------------------------------- */
  if (!authHeader?.startsWith("Bearer "))
    throw new Error("Missing or malformed Authorization header");

  const token = authHeader.slice(7).trim();
  if (!token) throw new Error("Missing Privy token in header");

  const { userId } = await privy.verifyAuthToken(token);
  if (!userId) throw new Error("Invalid Privy token: no userId");

  const user = await privy.getUser(userId); // never returns undefined
  if (!user) throw new Error("Privy user not found");
  return { token, user }; // what the callers expect
}
