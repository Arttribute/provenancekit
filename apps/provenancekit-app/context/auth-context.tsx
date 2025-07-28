"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";

declare module "@privy-io/react-auth" {
  interface Google {
    picture?: string;
  }

  interface Discord {
    picture?: string;
  }

  interface Twitter {
    picture?: string;
  }
}

export interface AuthState {
  idToken?: string | null;
  username?: string;
  walletAddress?: string;
  profileImage?: string;
}

interface AuthContextType {
  /* status */
  loadingAuth: boolean;
  loggedIn: boolean;

  /* actions */
  login: () => Promise<void>;
  logout: () => Promise<void>;

  /* data */
  authState: AuthState;
  /** EIP‑1193 provider for the user’s primary wallet (if any) */
  eip1193Provider: any | null;
}

/* -------------------------------------------------------------------------- */
/* Context                                                                    */
/* -------------------------------------------------------------------------- */

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  /* ---------- core privy hooks ---------- */
  const {
    ready: privyReady,
    authenticated,
    user,
    login: privyLogin,
    logout: privyLogout,
    getAccessToken,
  } = usePrivy();

  const { wallets, ready: walletsReady } = useWallets();

  /* ---------- derived state ---------- */
  const [authState, setAuthState] = useState<AuthState>({});
  const [eipProvider, setEipProvider] = useState<any | null>(null);
  const loadingAuth = !privyReady || !walletsReady;

  /* ---------- pick a “primary” wallet & provider ---------- */
  useEffect(() => {
    (async () => {
      if (!walletsReady || wallets.length === 0) {
        setEipProvider(null);
        return;
      }
      const provider = await wallets[0].getEthereumProvider();
      setEipProvider(provider);
    })();
  }, [walletsReady, wallets]);

  /* ---------- sync AuthState ---------- */
  useEffect(() => {
    (async () => {
      if (!privyReady) return;

      if (!authenticated || !user) {
        localStorage.removeItem("idToken");
        setAuthState({});
        return;
      }

      /* fetch (or refetch) an access token */
      const token = await getAccessToken();

      const state: AuthState = {
        idToken: token,
        username:
          user.email?.address ??
          user.google?.email ??
          user.discord?.username ??
          user.wallet?.address ??
          user.id.slice(0, 10),
        walletAddress: user.wallet?.address ?? wallets[0]?.address,
        profileImage:
          user.google?.picture ??
          user.discord?.picture ??
          user.twitter?.picture ??
          undefined,
      };

      setAuthState(state);
      localStorage.setItem("idToken", token ?? "");
    })().catch(console.error);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [privyReady, authenticated, user, wallets]);

  /* ---------- auth actions ---------- */
  const login = async () => {
    try {
      await privyLogin();
    } catch (err) {
      console.error("[Privy] login error", err);
    }
  };

  const logout = async () => {
    try {
      await privyLogout();
    } catch (err) {
      console.error("[Privy] logout error", err);
    }
  };

  /* ---------- memoized context ---------- */
  const value: AuthContextType = useMemo(
    () => ({
      loadingAuth,
      loggedIn: authenticated,
      login,
      logout,
      authState,
      eip1193Provider: eipProvider,
    }),
    [loadingAuth, authenticated, authState, eipProvider]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/* -------------------------------------------------------------------------- */
/* Hook                                                                        */
/* -------------------------------------------------------------------------- */

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
};
