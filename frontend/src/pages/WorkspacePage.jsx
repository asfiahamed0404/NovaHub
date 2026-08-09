import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext.jsx";
import NovaHubLogo from "../components/NovaHubLogo.jsx";
import {
  ArrowLeftIcon,
  UsersIcon,
} from "../components/Icons.jsx";
import ThemeSelector from "../components/ThemeSelector.jsx";
import WorkspaceMessages from "../components/WorkspaceMessages.jsx";

import api from "../api/axios.js";

function WorkspaceTopbar() {
  return (
    <header className="app-header">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <NovaHubLogo />

        <div className="flex shrink-0 items-center gap-2">
          <ThemeSelector compact />

          <Link
            to="/dashboard"
            className="button button-secondary shrink-0"
          >
            <ArrowLeftIcon className="size-4" />
            <span className="sr-only sm:not-sr-only">
              Back to Dashboard
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}

function WorkspacePage() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  
  const { user } = useAuth();
  //const isCreator = user.id === workspace?.createdBy?._id;

  const [workspace, setWorkspace] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [isLeaving, setIsLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState("");

  useEffect(() => {
    const fetchWorkspace = async () => {
      try {
        setError("");
        setIsLoading(true);

        const response = await api.get(
          `/workspaces/${workspaceId}`
        );

        setWorkspace(response.data.workspace);
      } catch (error) {
        setError(
          error.response?.data?.message ||
            "Failed to load workspace."
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchWorkspace();
  }, [workspaceId]);

  const handleLeaveWorkspace = async () => {
    try {
      setLeaveError("");
      setIsLeaving(true);

      await api.delete(
        `/workspaces/${workspaceId}/leave`
      );

      navigate("/dashboard");
    } catch (error) {
      setLeaveError(
        error.response?.data?.message ||
          "Failed to leave workspace."
      );
    } finally {
      setIsLeaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="app-shell">
        <WorkspaceTopbar />

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div
            className="surface-panel text-body flex min-h-44 items-center justify-center gap-3 px-5 py-10"
            role="status"
            aria-live="polite"
          >
            <span className="spinner" aria-hidden="true" />
            <span>Loading workspace...</span>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-shell">
        <WorkspaceTopbar />

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <section className="surface-panel max-w-2xl p-5 sm:p-6">
            <p className="eyebrow">
              Workspace unavailable
            </p>
            <h1 className="text-heading mt-2 text-xl font-semibold">
              We couldn&apos;t open this workspace
            </h1>
            <p
              className="feedback feedback-error mt-4"
              role="alert"
            >
              {error}
            </p>
          </section>
        </main>
      </div>
    );
  }

  const isCreator = user.id === workspace.createdBy._id;

  return (
    <div className="app-shell">
      <WorkspaceTopbar />

      <main className="page-enter mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <section
          className="surface-panel overflow-hidden px-5 py-5 sm:px-6 sm:py-6"
          aria-labelledby="workspace-title"
        >
          <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="eyebrow">
                Active workspace
              </p>

              <h1
                id="workspace-title"
                className="text-heading mt-2 break-words text-2xl font-bold tracking-[-0.025em] sm:text-3xl"
              >
                {workspace.name}
              </h1>

              <p className="text-muted mt-2 max-w-3xl break-words text-sm leading-6 sm:text-base">
                {workspace.description ||
                  "No description yet."}
              </p>

              <dl className="text-muted mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                <div className="min-w-0">
                  <dt className="sr-only">Created by</dt>
                  <dd className="break-words">
                    Created by{" "}
                    <span className="text-body font-medium">
                      {workspace.createdBy.name}
                    </span>
                  </dd>
                </div>

                <div className="flex items-center gap-2">
                  <dt className="sr-only">Member count</dt>
                  <UsersIcon className="icon-muted size-4 shrink-0" />
                  <dd>
                    {workspace.members.length}{" "}
                    {workspace.members.length === 1
                      ? "member"
                      : "members"}
                  </dd>
                </div>
              </dl>
            </div>

            {!isCreator && (
              <button
                type="button"
                onClick={handleLeaveWorkspace}
                disabled={isLeaving}
                className="button button-danger shrink-0 self-start"
                aria-busy={isLeaving}
              >
                {isLeaving && (
                  <span className="spinner" aria-hidden="true" />
                )}
                {isLeaving
                  ? "Leaving..."
                  : "Leave Workspace"}
              </button>
            )}
          </div>

          {leaveError && (
            <p
              className="feedback feedback-error mt-5"
              role="alert"
            >
              {leaveError}
            </p>
          )}
        </section>

        <div className="mt-6 grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <WorkspaceMessages workspaceId={workspaceId} />

          <aside
            className="surface-panel flex min-w-0 flex-col overflow-hidden lg:h-[70dvh] lg:min-h-[30rem] lg:max-h-[42rem]"
            aria-labelledby="workspace-members-heading"
          >
            <div className="border-theme border-b px-5 py-4">
              <div className="flex items-center gap-3">
                <span
                  className="accent-tile flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)]"
                  aria-hidden="true"
                >
                  <UsersIcon className="size-4" />
                </span>

                <div className="min-w-0">
                  <h2
                    id="workspace-members-heading"
                    className="text-heading font-semibold"
                  >
                    Members
                  </h2>
                  <p className="text-muted text-xs">
                    {workspace.members.length} in this workspace
                  </p>
                </div>
              </div>
            </div>

            <ul className="scroll-area max-h-96 space-y-3 overflow-y-auto p-4 lg:min-h-0 lg:max-h-none lg:flex-1">
              {workspace.members.map((member) => (
                <li
                  key={member._id}
                  className="surface-subtle min-w-0 p-3"
                >
                  <p className="text-heading break-words text-sm font-semibold">
                    {member.name}
                  </p>

                  <p className="text-muted mt-1 break-all text-xs leading-5">
                    {member.email}
                  </p>

                  <p className="border-theme text-muted mt-3 border-t pt-2 text-xs leading-5">
                    <span className="text-body font-semibold">
                      Profile status:
                    </span>{" "}
                    <span className="break-words">
                      {member.status || "Not set"}
                    </span>
                  </p>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </main>
    </div>
  );
}

export default WorkspacePage;
