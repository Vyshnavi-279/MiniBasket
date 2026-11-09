import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import { useApi } from "@/lib/api";

const MeContext = createContext(null);

export function MeProvider({ children }) {
  const { isLoaded, isSignedIn } = useAuth();
  const api = useApi();
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    if (!isSignedIn) {
      setMe(null);
      setError(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get("/me");
      setMe(data);
      setError(false);
    } catch {
      setMe(null);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [isSignedIn, api]);

  useEffect(() => {
    if (isLoaded) {
      refresh();
    }
  }, [isLoaded, refresh]);

  return (
    <MeContext.Provider value={{ me, role: me?.role, loading: !isLoaded || loading, error, refresh }}>
      {children}
    </MeContext.Provider>
  );
}

export const useMe = () => useContext(MeContext);
