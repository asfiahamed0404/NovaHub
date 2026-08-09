import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import api from "../api/axios.js";

const AuthContext = createContext(null);

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const restoreUser = async () => {
      const token = localStorage.getItem("novahub_token");

      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await api.get("/auth/me");

        setUser(response.data.user);
      } catch {
        localStorage.removeItem("novahub_token");
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    restoreUser();
  }, []);

  const logout = () => {
    localStorage.removeItem("novahub_token");
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        isLoading,
        logout,
      }}
    >
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
