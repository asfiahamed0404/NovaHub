// import LoginPage from "./pages/LoginPage.jsx";

// function App() {
//   return <LoginPage />;
// }

// export default App;

// import { useState } from "react";

// import api from "./api/axios.js";
// import LoginPage from "./pages/LoginPage.jsx";
// import DashboardPage from "./pages/DashboardPage.jsx";

// function App() {
//   const [user, setUser] = useState(null);
//   const [isLoading, setIsLoading] = useState(true);

//   if (user) {
//     return <DashboardPage user={user} />;
//   }

//   return <LoginPage onLoginSuccess={setUser} />;
// }

// export default App;

//import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router";
import ProtectedRoute from "./routes/ProtectedRoute.jsx";
import { useAuth } from "./context/AuthContext.jsx";

//import api from "./api/axios.js";
import LoginPage from "./pages/LoginPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import WorkspacePage from "./pages/WorkspacePage.jsx";

function App() {
  //const [user, setUser] = useState(null);
  // const { user, setUser, logout } = useAuth();
  // const [isLoading, setIsLoading] = useState(true);
  const {user,setUser,isLoading} = useAuth();

  // const handleLogout = () => {
  //   localStorage.removeItem("novahub_token");
  //   setUser(null);
  // };

  // useEffect(() => {
  //   const restoreUser = async () => {
  //     const token = localStorage.getItem("novahub_token");

  //     if (!token) {
  //       setIsLoading(false);
  //       return;
  //     }

  //     try {
  //       const response = await api.get("/auth/me");

  //       setUser(response.data.user);
  //     } catch (error) {
  //       localStorage.removeItem("novahub_token");
  //       setUser(null);
  //     } finally {
  //       setIsLoading(false);
  //     }
  //   };

  //   restoreUser();
  // }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <p className="text-slate-300">
          Loading NovaHub...
        </p>
      </div>
    );
  }

  //if (user) { return <DashboardPage user={user} onLogout={handleLogout} />;}

  //return <LoginPage onLoginSuccess={setUser} />;
  //return <RegisterPage onRegisterSuccess={setUser} />;
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

      {/* <Route
        path="/dashboard"
        element={
          user ? (
            <DashboardPage
              user={user}
              onLogout={handleLogout}
            />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      /> */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
          {/*<ProtectedRoute user={user}>*/}
            {/* <DashboardPage user={user} onLogout={logout} /> */} 
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