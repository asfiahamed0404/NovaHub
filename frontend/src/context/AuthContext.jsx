import {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import api from "../api/axios.js";

const AuthContext = createContext(null);

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem("novahub_token");
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem("novahub_token");

    if (!token) {
      setUser(null);
      return null;
    }

    try {
      const response = await api.get("/auth/me");
      const refreshedUser = response.data.user;

      setUser(refreshedUser);
      return refreshedUser;
    } catch {
      logout();
      return null;
    }
  }, [logout]);

  useEffect(() => {
    const restoreUser = async () => {
      try {
        await refreshUser();
      } finally {
        setIsLoading(false);
      }
    };

    restoreUser();
  }, [refreshUser]);

  const contextValue = useMemo(
    () => ({
      user,
      setUser,
      isLoading,
      logout,
      refreshUser,
    }),
    [isLoading, logout, refreshUser, user]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider"
    );
  }

  return context;
}

// eslint-disable-next-line react-refresh/only-export-components -- Keep the provider and hook together in this learning module.
export { AuthProvider, useAuth };
