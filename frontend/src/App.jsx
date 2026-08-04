// import LoginPage from "./pages/LoginPage.jsx";

// function App() {
//   return <LoginPage />;
// }

// export default App;

import { useState } from "react";

import LoginPage from "./pages/LoginPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";

function App() {
  const [user, setUser] = useState(null);

  if (user) {
    return <DashboardPage user={user} />;
  }

  return <LoginPage onLoginSuccess={setUser} />;
}

export default App;