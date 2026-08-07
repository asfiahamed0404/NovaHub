import { useState } from "react";

import api from "../api/axios.js";

function JoinWorkspaceForm({ onWorkspaceJoined }) {
  const [workspaceId, setWorkspaceId] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      setError("");
      setIsSubmitting(true);

      const response = await api.post(
        `/workspaces/${workspaceId}/join`
      );

      onWorkspaceJoined(response.data.workspace);

      setWorkspaceId("");
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "Failed to join workspace."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900 p-5">
      <h2 className="text-xl font-semibold">
        Join Workspace
      </h2>

      <p className="mt-2 text-sm text-slate-400">
        Enter a workspace ID to join.
      </p>

      {error && (
        <p className="mt-3 text-sm text-red-400">
          {error}
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        className="mt-4 flex gap-3"
      >
        <input
          type="text"
          value={workspaceId}
          onChange={(event) =>
            setWorkspaceId(event.target.value)
          }
          placeholder="Workspace ID"
          required
          className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500"
        />

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-blue-600 px-5 py-3 font-semibold hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting
            ? "Joining..."
            : "Join"}
        </button>
      </form>
    </div>
  );
}

export default JoinWorkspaceForm;