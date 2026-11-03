import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../../services/supabase";
interface AuthState {
  user: User | null;
  loading: boolean;
  error: string;
  recovery: boolean;
  clearRecovery: () => void;
  local: boolean;
  enterLocal: () => void;
  signOut: () => Promise<void>;
}
const AuthContext = createContext<AuthState | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!!supabase);
  const [error, setError] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [local, setLocal] = useState(
    () => !supabase && sessionStorage.getItem("gp:local") === "true",
  );
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (active) {
        setUser(session?.user ?? null);
        setLoading(false);
        if (event === "PASSWORD_RECOVERY") setRecovery(true);
      }
    });
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (active) {
          if (error) setError(error.message);
          setUser(data.session?.user ?? null);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (active) {
          setError(String(e));
          setLoading(false);
        }
      });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  async function signOut() {
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    }
    setUser(null);
    setLocal(false);
    sessionStorage.removeItem("gp:local");
  }
  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        recovery,
        clearRecovery: () => setRecovery(false),
        local,
        enterLocal: () => {
          sessionStorage.setItem("gp:local", "true");
          setLocal(true);
        },
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("AuthProvider missing");
  return ctx;
}
