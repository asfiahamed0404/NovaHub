// function LoginPage() {
//   return (
//     <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
//       <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8">
//         <h1 className="text-3xl font-bold">Welcome back</h1>

//         <p className="mt-2 text-slate-400">
//           Login to continue to NovaHub.
//         </p>

//         <div className="mt-6 space-y-4">
//           <div>
//             <label className="text-sm text-slate-300">Email</label>

//             <input
//               type="email"
//               placeholder="you@example.com"
//               className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500"
//             />
//           </div>

//           <div>
//             <label className="text-sm text-slate-300">Password</label>

//             <input
//               type="password"
//               placeholder="Enter your password"
//               className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500"
//             />
//           </div>

//           <button
//             type="button"
//             className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold hover:bg-blue-500"
//           >
//             Login
//           </button>
//         </div>

//         <p className="mt-6 text-center text-sm text-slate-400">
//           New to NovaHub?{" "}
//           <span className="text-blue-400">Create account</span>
//         </p>
//       </div>
//     </div>
//   );
// }

// export default LoginPage;

import { Link } from "react-router";
import { useState } from "react";

import AuthLayout from "../components/AuthLayout.jsx";
import api from "../api/axios.js";

function LoginPage({ onLoginSuccess }) {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (event) => {
    setError("");
    setMessage("");
    setFormData({
      ...formData,
      [event.target.name]: event.target.value,
    });
  };

  // const handleSubmit = (event) => {
  //   event.preventDefault();

  //   console.log("Login form submitted:");
  //   console.log(formData);
  // };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      setError("");
      setMessage("");
      setIsSubmitting(true);

      const response = await api.post("/auth/login", formData);

      localStorage.setItem("novahub_token", response.data.token);

      const profileResponse = await api.get("/auth/me");
      onLoginSuccess(profileResponse.data.user);

      
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "Login failed. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      description="Sign in to return to your workspaces and team conversations."
      footer={
        <p>
          New to NovaHub?{" "}
          <Link
            to="/register"
            className="auth-link rounded-sm font-semibold"
          >
            Create an account
          </Link>
        </p>
      }
    >
      <form
        onSubmit={handleSubmit}
        className="mt-6 space-y-5"
        aria-busy={isSubmitting}
      >
        {error && (
          <div id="login-error" className="feedback feedback-error" role="alert">
            {error}
          </div>
        )}

        {message && (
          <div className="feedback feedback-success" role="status">
            {message}
          </div>
        )}

        <div>
          <label htmlFor="login-email" className="form-label">
            Email address
          </label>

          <input
            id="login-email"
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="you@example.com"
            autoComplete="email"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "login-error" : undefined}
            required
            disabled={isSubmitting}
            className="form-input mt-2"
          />
        </div>

        <div>
          <label htmlFor="login-password" className="form-label">
            Password
          </label>

          <input
            id="login-password"
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="Enter your password"
            autoComplete="current-password"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "login-error" : undefined}
            required
            disabled={isSubmitting}
            className="form-input mt-2"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="button button-primary w-full"
        >
          {isSubmitting && <span className="spinner" aria-hidden="true" />}
          {isSubmitting ? "Logging in..." : "Log in"}
        </button>
      </form>
    </AuthLayout>
  );
}

export default LoginPage;
