"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { fetchAuthMe, postDevLogin, postLogout } from "@/lib/auth/api-auth";
import { DEV_USER_ID, setResolvedUserId } from "@/lib/dev-api";

const AuthUserContext = createContext<string>(DEV_USER_ID);

const AuthActionsContext = createContext<{
  refresh: () => Promise<void>;
  devLogin: (userId?: string) => Promise<boolean>;
  logout: () => Promise<void>;
} | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState(DEV_USER_ID);

  const applyMe = useCallback(async () => {
    const me = await fetchAuthMe();
    if (!me) {
      setUserId(DEV_USER_ID);
      setResolvedUserId(DEV_USER_ID);
      return;
    }
    const id = me.authenticated ? me.user.userId : me.userId;
    setUserId(id);
    setResolvedUserId(id);
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

  const logout = useCallback(async () => {
    await postLogout();
    await applyMe();
  }, [applyMe]);

  const actions = useMemo(
    () => ({
      refresh: applyMe,
      devLogin,
      logout,
    }),
    [applyMe, devLogin, logout],
  );

  return (
    <AuthUserContext.Provider value={userId}>
      <AuthActionsContext.Provider value={actions}>{children}</AuthActionsContext.Provider>
    </AuthUserContext.Provider>
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
