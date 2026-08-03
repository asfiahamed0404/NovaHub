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

import { useState } from "react";
import api from "../api/axios.js";

function LoginPage() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (event) => {
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

      setMessage(response.data.message);
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
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8">
        <h1 className="text-3xl font-bold">Welcome back</h1>

        <p className="mt-2 text-slate-400">
          Login to continue to NovaHub.
        </p>

        {error && (
          <div className="mt-5 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {message && (
          <div className="mt-5 rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-300">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-sm text-slate-300">Email</label>

            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="you@example.com"
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-sm text-slate-300">Password</label>

            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter your password"
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Logging in..." : "Login"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          New to NovaHub?{" "}
          <span className="text-blue-400">Create account</span>
        </p>
      </div>
    </div>
  );
}

export default LoginPage;