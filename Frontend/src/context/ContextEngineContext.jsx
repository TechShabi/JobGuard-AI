import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useAuth } from "./AuthContext";
import {
  getActiveContextService,
  createContextService,
  clearContextService,
} from "../services/context.service";

const ContextEngineContext = createContext();

// Context Engine — Project ka hidden brain.
// Rules:
// - Active Context sirf 1.
// - Automatically kabhi replace nahi hota — hamesha user confirmation ke baad.
// - Guest ke liye localStorage, logged-in user ke liye backend (DB) mein persist.
export function ContextEngineProvider({ children }) {
  const { isLoggedIn } = useAuth();
  const [context, setContext] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load active context on mount / when auth state changes
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        if (isLoggedIn) {
          const { data } = await getActiveContextService();
          setContext(data?.context || null);
        } else {
          // Guest users never restore context.
          // Context only lives in React state.
          setContext(null);
        }
      } catch (err) {
        console.error("ContextEngine load error:", err);
        setContext(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isLoggedIn]);

  // Actually create/replace the active context (call ONLY after user confirmation
  // if a context already exists — see requestSetContext below)
  const setActiveContext = useCallback(
    async (payload) => {
      // payload: { source_module, company, role, experience, description }
      if (isLoggedIn) {
        const { data } = await createContextService(payload);
        setContext(data.context);
        return data.context;
      } else {
        const guestContext = {
          ...payload,
          id: "guest",
          is_active: true,
          createdAt: new Date().toISOString(),
        };

        setContext(guestContext);

        return guestContext;
      }
    },
    [isLoggedIn]
  );

  // Rule 3 + Context replace rule: agar context already active hai to caller
  // (UI) ko pehle confirmation dialog dikhana chahiye, phir setActiveContext call karo.
  // Ye helper batata hai ki confirmation chahiye ya nahi.
  const needsReplaceConfirmation = useCallback(
    (newRole) => {
      return !!context && context.role !== newRole;
    },
    [context]
  );

  const clearActiveContext = useCallback(async () => {
    if (isLoggedIn) {
      await clearContextService();
    } else {
      // Nothing to clear from storage.
    }
    setContext(null);
  }, [isLoggedIn]);

  return (
    <ContextEngineContext.Provider
      value={{
        context,
        loading,
        hasContext: !!context,
        setActiveContext,
        needsReplaceConfirmation,
        clearActiveContext,
      }}
    >
      {children}
    </ContextEngineContext.Provider>
  );
}

export function useContextEngine() {
  const ctx = useContext(ContextEngineContext);
  if (!ctx) throw new Error("useContextEngine must be used inside ContextEngineProvider");
  return ctx;
}
