import { useState } from "react";

import api from "../api/axios.js";
import { UsersIcon } from "./Icons.jsx";

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
    <section
      className="surface-panel p-5 sm:p-6"
      aria-labelledby="join-workspace-heading"
    >
      <span className="accent-tile flex size-9 items-center justify-center rounded-[10px]">
        <UsersIcon className="size-4" />
      </span>

      <h2
        id="join-workspace-heading"
        className="text-heading mt-4 text-lg font-semibold tracking-[-0.015em]"
      >
        Join a workspace
      </h2>
      <p className="text-muted mt-2 text-sm leading-6">
        Connect to an existing team space using its workspace ID.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-5 space-y-4"
        aria-busy={isSubmitting}
      >
        <div>
          <label htmlFor="workspace-id" className="form-label">
            Workspace ID
          </label>
          <p id="workspace-id-help" className="text-muted mt-1 text-xs leading-5">
            Enter a workspace ID shared with you.
          </p>

          <input
            id="workspace-id"
            type="text"
            value={workspaceId}
            onChange={(event) => {
              setError("");
              setWorkspaceId(event.target.value);
            }}
            placeholder="Paste workspace ID"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-describedby={
              error
                ? "workspace-id-help join-workspace-error"
                : "workspace-id-help"
            }
            aria-invalid={Boolean(error)}
            required
            disabled={isSubmitting}
            className="form-input mt-2"
          />
        </div>

        {error && (
          <div
            id="join-workspace-error"
            className="feedback feedback-error"
            role="alert"
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="button button-primary w-full"
        >
          {isSubmitting && <span className="spinner" aria-hidden="true" />}
          {isSubmitting ? "Joining..." : "Join workspace"}
        </button>
      </form>
    </section>
  );
}

export default JoinWorkspaceForm;
