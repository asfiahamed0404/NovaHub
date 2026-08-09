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
