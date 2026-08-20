import { useState } from "react";
import { Link, useLocation } from "react-router";

import AuthLayout from "../components/AuthLayout.jsx";
import api from "../api/axios.js";
import { getSafeInvitationReturnPath } from "../utils/invitationPath.js";

function RegisterPage({ onRegisterSuccess }) {
  const location = useLocation();
  const invitationReturnPath =
    getSafeInvitationReturnPath(location.state);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (event) => {
    setError("");
    setFormData({
      ...formData,
      [event.target.name]: event.target.value,
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      setError("");
      setIsSubmitting(true);

      const response = await api.post("/auth/register",formData);

      localStorage.setItem("novahub_token",response.data.token);

      onRegisterSuccess(response.data.user);
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "Registration failed. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      description={
        invitationReturnPath
          ? "Create an account to review and accept your workspace invitation."
          : "Set up your profile and start collaborating in a focused workspace."
      }
      footer={
        <p>
          Already have an account?{" "}
          <Link
            to="/login"
            state={
              invitationReturnPath
                ? { from: invitationReturnPath }
                : undefined
            }
            className="auth-link rounded-sm font-semibold"
          >
            Log in
          </Link>
        </p>
      }
    >
      <form
        onSubmit={handleSubmit}
        className="mt-6 space-y-5"
        aria-busy={isSubmitting}
      >
        {invitationReturnPath && (
          <div className="feedback feedback-success" role="status">
            Your invitation is ready. Create your account to continue.
          </div>
        )}

        {error && (
          <div id="register-error" className="feedback feedback-error" role="alert">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="register-name" className="form-label">
            Name
          </label>

          <input
            id="register-name"
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Your name"
            autoComplete="name"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "register-error" : undefined}
            required
            minLength={2}
            disabled={isSubmitting}
            className="form-input mt-2"
          />
        </div>

        <div>
          <label htmlFor="register-email" className="form-label">
            Email address
          </label>

          <input
            id="register-email"
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="you@example.com"
            autoComplete="email"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "register-error" : undefined}
            required
            disabled={isSubmitting}
            className="form-input mt-2"
          />
        </div>

        <div>
          <label htmlFor="register-password" className="form-label">
            Password
          </label>
          <p id="register-password-help" className="text-muted mt-1 text-xs">
            Use at least 6 characters.
          </p>

          <input
            id="register-password"
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="At least 6 characters"
            autoComplete="new-password"
            aria-invalid={Boolean(error)}
            aria-describedby={
              error
                ? "register-password-help register-error"
                : "register-password-help"
            }
            required
            minLength={6}
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
          {isSubmitting ? "Creating account..." : "Create account"}
        </button>
      </form>
    </AuthLayout>
  );
}

export default RegisterPage;
