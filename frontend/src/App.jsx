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

function App() {
  const { user, setUser, isLoading } = useAuth();
  const location = useLocation();
  const authReturnPath =
    getSafeInvitationReturnPath(location.state) ||
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
