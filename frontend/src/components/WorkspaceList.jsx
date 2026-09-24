import { useEffect, useState } from "react";
import { Link } from "react-router";

import api from "../api/axios.js";
import { ArrowRightIcon, UsersIcon } from "./Icons.jsx";

function WorkspaceList({ workspaces, setWorkspaces }) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const filteredWorkspaces = workspaces.filter((workspace) =>
    `${workspace.name} ${workspace.description || ""}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );

  useEffect(() => {
    const fetchWorkspaces = async () => {
      try {
        setError("");
        setIsLoading(true);

        const response = await api.get("/workspaces");

        setWorkspaces(response.data.workspaces);
      } catch (error) {
        setError(error.response?.data?.message || "Failed to load workspaces.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchWorkspaces();
  }, [setWorkspaces]);

  return (
    <section
      className="workspace-library min-w-0"
      aria-labelledby="workspaces-heading"
      aria-busy={isLoading}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="workspaces-heading"
            className="text-heading text-xl font-semibold tracking-[-0.02em]"
          >
            Your Workspaces
          </h2>
          <p className="text-muted mt-2 text-sm leading-6">
            Your people. Your projects. All in one place.
          </p>
        </div>

        {!isLoading && !error && (
          <span className="meta-badge rounded-md px-2.5 py-1 text-xs font-semibold">
            {workspaces.length}{" "}
            {workspaces.length === 1 ? "workspace" : "workspaces"}
          </span>
        )}
      </div>

      <div className="workspace-search">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          aria-hidden="true"
        >
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m16 16 4 4" />
        </svg>
        <input
          type="search"
          aria-label="Search workspaces"
          placeholder="Find a workspace..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {isLoading && (
        <div className="mt-6" role="status" aria-live="polite">
          <span className="sr-only">Loading workspaces...</span>
          <div className="grid gap-3 md:grid-cols-2" aria-hidden="true">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="surface-subtle p-4">
                <div className="skeleton h-5 w-2/3" />
                <div className="skeleton mt-3 h-4 w-full" />
                <div className="skeleton mt-2 h-4 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="feedback feedback-error mt-6" role="alert">
          {error}
        </div>
      )}

      {!isLoading && !error && workspaces.length === 0 && (
        <div className="surface-subtle mt-6 px-5 py-8 text-center">
          <span className="accent-tile mx-auto flex size-10 items-center justify-center rounded-[10px]">
            <UsersIcon className="size-5" />
          </span>
          <h3 className="text-heading mt-4 font-semibold">No workspaces yet</h3>
          <p className="text-muted mx-auto mt-2 max-w-sm text-sm leading-6">
            Create a workspace for your team, or open a secure invitation link
            shared by a current member.
          </p>
        </div>
      )}

      {!isLoading && !error && workspaces.length > 0 && (
        <ul className="mt-5 grid gap-4 md:grid-cols-2">
          {filteredWorkspaces.map((workspace, index) => (
            <li key={workspace._id} className="min-w-0">
              <Link
                to={`/workspaces/${workspace._id}`}
                className="workspace-card group flex h-full min-w-0 flex-col p-5 motion-safe:hover:-translate-y-0.5"
              >
                <span
                  className={`workspace-monogram monogram-${index % 4}`}
                  aria-hidden="true"
                >
                  {workspace.name?.slice(0, 2).toUpperCase() || "WS"}
                </span>
                <span className="flex min-w-0 items-start justify-between gap-3">
                  <span className="text-heading min-w-0 break-words font-semibold">
                    {workspace.name}
                  </span>
                  <ArrowRightIcon className="workspace-card-arrow mt-0.5 size-4 shrink-0" />
                </span>

                <span className="text-muted mt-2 line-clamp-2 break-words text-sm leading-6">
                  {workspace.description ||
                    "Open this workspace to continue the conversation."}
                </span>

                <span className="workspace-card-footer text-muted mt-5 flex items-center gap-1.5 text-xs font-medium">
                  <UsersIcon className="size-3.5" />
                  {workspace.members?.length ?? 0}{" "}
                  {workspace.members?.length === 1 ? "member" : "members"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {!isLoading &&
        !error &&
        workspaces.length > 0 &&
        filteredWorkspaces.length === 0 && (
          <div className="surface-subtle mt-5 p-8 text-center" role="status">
            <h3 className="text-heading font-semibold">
              No matching workspaces
            </h3>
            <p className="text-muted mt-2 text-sm">
              Try another name or clear your search.
            </p>
            <button
              type="button"
              className="button button-secondary mt-4"
              onClick={() => setQuery("")}
            >
              Clear search
            </button>
          </div>
        )}
    </section>
  );
}

export default WorkspaceList;
