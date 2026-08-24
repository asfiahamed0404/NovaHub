import {
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router";
import ProtectedRoute from "./routes/ProtectedRoute.jsx";
import { useAuth } from "./context/AuthContext.jsx";

//import api from "./api/axios.js";
import LoginPage from "./pages/LoginPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import WorkspacePage from "./pages/WorkspacePage.jsx";
import InvitationPage from "./pages/InvitationPage.jsx";
import NovaHubLogo from "./components/NovaHubLogo.jsx";
import { getSafeInvitationReturnPath } from "./utils/invitationPath.js";
import AdminRoute from "./admin/AdminRoute.jsx";
import AdminLayout from "./admin/components/AdminLayout.jsx";
import AdminOverviewPage from "./admin/pages/AdminOverviewPage.jsx";
import AdminUsersPage from "./admin/pages/AdminUsersPage.jsx";
import AdminWorkspacesPage from "./admin/pages/AdminWorkspacesPage.jsx";
import AdminAiUsagePage from "./admin/pages/AdminAiUsagePage.jsx";
import AdminMemoriesPage from "./admin/pages/AdminMemoriesPage.jsx";

function App() {
  const { user, setUser, isLoading } = useAuth();
  const location = useLocation();
  const requestedAdminPath =
    user?.role === "admin" &&
    typeof location.state?.from === "string" &&
    /^\/admin(?:[/?#]|$)/.test(location.state.from)
      ? location.state.from
      : "";
  const authReturnPath =
    getSafeInvitationReturnPath(location.state) ||
    requestedAdminPath ||
    "/dashboard";

  if (isLoading) {
    return (
      <main
        className="app-shell flex items-center justify-center px-4"
        aria-busy="true"
      >
        <div className="page-enter flex flex-col items-center text-center">
          <NovaHubLogo showTagline />

          <div
            className="text-muted mt-8 flex items-center gap-3 text-sm"
            role="status"
            aria-live="polite"
          >
            <span className="spinner text-accent" aria-hidden="true" />
            <span>Restoring your NovaHub session...</span>
          </div>
        </div>
      </main>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          user ? (
            <Navigate to={authReturnPath} replace />
          ) : (
            <LoginPage onLoginSuccess={setUser} />
          )
        }
      />

      <Route
        path="/register"
        element={
          user ? (
            <Navigate to={authReturnPath} replace />
          ) : (
            <RegisterPage onRegisterSuccess={setUser} />
          )
        }
      />

      <Route
        path="/invite/:token"
        element={<InvitationPage />}
      />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/workspaces/:workspaceId"
        element={
          <ProtectedRoute>
            <WorkspacePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminLayout />
          </AdminRoute>
        }
      >
        <Route index element={<AdminOverviewPage />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route
          path="workspaces"
          element={<AdminWorkspacesPage />}
        />
        <Route
          path="ai-usage"
          element={<AdminAiUsagePage />}
        />
        <Route
          path="memories"
          element={<AdminMemoriesPage />}
        />
      </Route>

      <Route
        path="/"
        element={
          <Navigate
            to={user ? "/dashboard" : "/login"}
            replace
          />
        }
      />

      <Route
        path="*"
        element={
          <Navigate
            to={user ? "/dashboard" : "/login"}
            replace
          />
        }
      />
    </Routes>
  );
}

export default App;
