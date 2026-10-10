"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { AuthMeResponse } from "@/lib/auth/api-auth";
import { fetchAuthMe, postDevLogin, postLogout, postTelegramLogin } from "@/lib/auth/api-auth";
import { DEV_USER_ID, hasAuthApi, setResolvedUserId } from "@/lib/dev-api";

const AuthUserContext = createContext<string>(DEV_USER_ID);

const AuthActionsContext = createContext<{
  refresh: () => Promise<void>;
  devLogin: (userId?: string) => Promise<boolean>;
  /** "rejected" = server refused initData; "no-session" = accepted but `/auth/me` still unauthenticated. */
  telegramLogin: (initData: string) => Promise<"ok" | "rejected" | "no-session">;
  logout: () => Promise<void>;
} | null>(null);

/** For route gate: `me === undefined` means still loading when API is configured. */
const AuthSessionContext = createContext<{
  /** No `NEXT_PUBLIC_API_URL` — skip server session gate. */
  skipGate: boolean;
  /** First `/auth/me` finished (or skipped). */
  ready: boolean;
  /** Populated when `ready` and API configured; `null` = network/HTTP failure. */
  me: AuthMeResponse | null;
}>({ skipGate: true, ready: true, me: null });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState(DEV_USER_ID);
  const [skipGate] = useState(() => !hasAuthApi());
  const [ready, setReady] = useState(skipGate);
  const [me, setMe] = useState<AuthMeResponse | null>(null);

  const applyMe = useCallback(async (): Promise<AuthMeResponse | null> => {
    if (!hasAuthApi()) {
      setReady(true);
      setMe(null);
      setUserId(DEV_USER_ID);
      setResolvedUserId(DEV_USER_ID);
      return null;
    }
    // `ready` stays true on refreshes: flipping it back makes the auth gate swap the whole app
    // for a spinner, unmounting the current page (and losing its state) on every refresh.
    const res = await fetchAuthMe();
    setReady(true);
    if (!res) {
      setMe(null);
      setUserId(DEV_USER_ID);
      setResolvedUserId(DEV_USER_ID);
      return null;
    }
    setMe(res);
    const id = res.authenticated ? res.user.userId : res.userId;
    setUserId(id);
    setResolvedUserId(id);
    return res;
  }, []);

  useEffect(() => {
    void applyMe();
  }, [applyMe]);

  const devLogin = useCallback(
    async (uid?: string) => {
      const r = await postDevLogin({ userId: uid });
      if (!r) return false;
      await applyMe();
      return true;
    },
    [applyMe],
  );

  const telegramLogin = useCallback(
    async (initData: string) => {
      const r = await postTelegramLogin(initData).catch(() => null);
      if (!r) return "rejected" as const;
      const me = await applyMe();
      return me?.authenticated ? ("ok" as const) : ("no-session" as const);
    },
    [applyMe],
  );

  const logout = useCallback(async () => {
    await postLogout();
    await applyMe();
  }, [applyMe]);

  const actions = useMemo(
    () => ({
      refresh: async () => {
        await applyMe();
      },
      devLogin,
      telegramLogin,
      logout,
    }),
    [applyMe, devLogin, telegramLogin, logout],
  );

  const sessionValue = useMemo(
    () => ({ skipGate, ready, me }),
    [skipGate, ready, me],
  );

  return (
    <AuthSessionContext.Provider value={sessionValue}>
      <AuthUserContext.Provider value={userId}>
        <AuthActionsContext.Provider value={actions}>{children}</AuthActionsContext.Provider>
      </AuthUserContext.Provider>
    </AuthSessionContext.Provider>
  );
}

export function useAuthUserId(): string {
  return useContext(AuthUserContext);
}

export function useAuthActions() {
  const v = useContext(AuthActionsContext);
  if (!v) throw new Error("useAuthActions must be used within AuthProvider");
  return v;
}

export function useAuthSession() {
  return useContext(AuthSessionContext);
}
