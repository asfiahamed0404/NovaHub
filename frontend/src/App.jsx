import { Navigate, Route, Routes } from "react-router";
import ProtectedRoute from "./routes/ProtectedRoute.jsx";
import { useAuth } from "./context/AuthContext.jsx";

//import api from "./api/axios.js";
import LoginPage from "./pages/LoginPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import WorkspacePage from "./pages/WorkspacePage.jsx";
import NovaHubLogo from "./components/NovaHubLogo.jsx";

function App() {
  const {user,setUser,isLoading} = useAuth();

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
            <Navigate to="/dashboard" replace />
          ) : (
            <LoginPage onLoginSuccess={setUser} />
          )
        }
      />

      <Route
        path="/register"
        element={
          user ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <RegisterPage onRegisterSuccess={setUser} />
          )
        }
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
