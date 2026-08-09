import { useState } from "react";
import api from "../api/axios.js";
import { PlusIcon } from "./Icons.jsx";

function CreateWorkspaceForm({ onWorkspaceCreated }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // const handleSubmit = (event) => {
  //   event.preventDefault();

  //   console.log("Workspace name:", name);
  // };
  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      setError("");
      setIsSubmitting(true);

      const response = await api.post("/workspaces", {
        name: name,
      });

      onWorkspaceCreated(response.data.workspace);

      setName("");
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "Failed to create workspace."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section
      className="surface-panel p-5 sm:p-6"
      aria-labelledby="create-workspace-heading"
    >
      <span className="accent-tile flex size-9 items-center justify-center rounded-[10px]">
        <PlusIcon className="size-4" />
      </span>

      <h2
        id="create-workspace-heading"
        className="text-heading mt-4 text-lg font-semibold tracking-[-0.015em]"
      >
        Create a workspace
      </h2>
      <p className="text-muted mt-2 text-sm leading-6">
        Start a focused space for a project or team.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-5 space-y-4"
        aria-busy={isSubmitting}
      >
        <div>
          <label htmlFor="workspace-name" className="form-label">
            Workspace name
          </label>
          <p id="workspace-name-help" className="text-muted mt-1 text-xs leading-5">
            Choose a short name your team will recognize.
          </p>

          <input
            id="workspace-name"
            type="text"
            value={name}
            onChange={(event) => {
              setError("");
              setName(event.target.value);
            }}
            placeholder="e.g. Product launch"
            aria-describedby={
              error
                ? "workspace-name-help create-workspace-error"
                : "workspace-name-help"
            }
            aria-invalid={Boolean(error)}
            required
            minLength={2}
            maxLength={100}
            disabled={isSubmitting}
            className="form-input mt-2"
          />
        </div>

        {error && (
          <div
            id="create-workspace-error"
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
          {isSubmitting ? "Creating..." : "Create workspace"}
        </button>
      </form>
    </section>
  );
}

export default CreateWorkspaceForm;
