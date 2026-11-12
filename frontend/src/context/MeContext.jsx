import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/react";
import { useApi } from "@/lib/api";

const MeContext = createContext(null);

export function MeProvider({ children }) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const api = useApi();
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const latest = useRef(0);

  const refresh = useCallback(async () => {
    const req = ++latest.current;
    if (!isSignedIn) {
      setMe(null);
      setError(false);
      setLoading(false);
      return;
    }
    setMe(null);
    setLoading(true);
    try {
      const { data } = await api.get("/me");
      if (req !== latest.current) return;
      setMe(data);
      setError(false);
    } catch {
      if (req !== latest.current) return;
      setError(true);
    } finally {
      if (req === latest.current) setLoading(false);
    }
  }, [isSignedIn, api]);

  useEffect(() => {
    if (isLoaded) {
      refresh();
    }
  }, [isLoaded, userId, refresh]);

  return (
    <MeContext.Provider value={{ me, role: me?.role, loading: !isLoaded || loading, error, refresh }}>
      {children}
    </MeContext.Provider>
  );
}

export const useMe = () => useContext(MeContext);
