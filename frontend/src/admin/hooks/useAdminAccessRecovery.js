import { useCallback } from "react";
import { useNavigate } from "react-router";

import { useAuth } from "../../context/AuthContext.jsx";
import { isAdminSessionExpired } from "../api/adminApi.js";

function useAdminAccessRecovery() {
  const { logout, refreshUser } = useAuth();
  const navigate = useNavigate();

  return useCallback(
    async (error) => {
      if (isAdminSessionExpired(error)) {
        logout();
        return true;
      }

      if (error?.status === 403) {
        try {
          await refreshUser();
        } finally {
          navigate("/dashboard", { replace: true });
        }

        return true;
      }

      return false;
    },
    [logout, navigate, refreshUser]
  );
}

export default useAdminAccessRecovery;
