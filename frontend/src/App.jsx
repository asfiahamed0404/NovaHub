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

import { useEffect, useState } from "react";

import api from "./api/axios.js";
import LoginPage from "./pages/LoginPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";

function App() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const handleLogout = () => {
    localStorage.removeItem("novahub_token");
    setUser(null);
  };

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
      } catch (error) {
        localStorage.removeItem("novahub_token");
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    restoreUser();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <p className="text-slate-300">
          Loading NovaHub...
        </p>
      </div>
    );
  }

  if (user) {
    return <DashboardPage user={user} onLogout={handleLogout} />;
  }

  //return <LoginPage onLoginSuccess={setUser} />;
  return <RegisterPage onRegisterSuccess={setUser} />;
}

export default App;