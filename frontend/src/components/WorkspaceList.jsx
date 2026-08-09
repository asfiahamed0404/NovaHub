import { useEffect, useState } from "react";
import { Link } from "react-router";

import api from "../api/axios.js";
import { ArrowRightIcon, UsersIcon } from "./Icons.jsx";

function WorkspaceList({workspaces,setWorkspaces,}) {

  // useEffect(() => {
  //   const fetchWorkspaces = async () => {
  //     try {
  //       const response = await api.get("/workspaces");

  //       //console.log("Workspace response:", response.data);
  //       setWorkspaces(response.data.workspaces);
  //     } catch (error) {
  //       console.error(
  //         "Failed to fetch workspaces:",
  //         error.response?.data || error.message
  //       );
  //     }
  //   };

  //   fetchWorkspaces();
  // }, []);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchWorkspaces = async () => {
      try {
        setError("");
        setIsLoading(true);

        const response = await api.get("/workspaces");

        setWorkspaces(response.data.workspaces);

      } catch (error) {
        setError(
          error.response?.data?.message ||
            "Failed to load workspaces."
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchWorkspaces();
  }, [setWorkspaces]);

  return (
    <section
      className="surface-panel min-w-0 p-5 sm:p-6"
      aria-labelledby="workspaces-heading"
      aria-busy={isLoading}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">
            Collaboration spaces
          </p>
          <h2
            id="workspaces-heading"
            className="text-heading mt-2 text-xl font-semibold tracking-[-0.02em]"
          >
            Your Workspaces
          </h2>
          <p className="text-muted mt-2 text-sm leading-6">
            Open a workspace to continue collaborating with your team.
          </p>
        </div>

        {!isLoading && !error && (
          <span className="meta-badge rounded-md px-2.5 py-1 text-xs font-semibold">
            {workspaces.length}{" "}
            {workspaces.length === 1 ? "workspace" : "workspaces"}
          </span>
        )}
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

      {!isLoading &&
        !error &&
        workspaces.length === 0 && (
          <div className="surface-subtle mt-6 px-5 py-8 text-center">
            <span className="accent-tile mx-auto flex size-10 items-center justify-center rounded-[10px]">
              <UsersIcon className="size-5" />
            </span>
            <h3 className="text-heading mt-4 font-semibold">
              No workspaces yet
            </h3>
            <p className="text-muted mx-auto mt-2 max-w-sm text-sm leading-6">
              Create a workspace for your team, or join one using an ID shared
              with you.
            </p>
          </div>
        )}

      {!isLoading && !error && workspaces.length > 0 && (
        <ul className="mt-6 grid gap-3 md:grid-cols-2">
          {workspaces.map((workspace) => (
            // <div
            //   key={workspace._id}
            //   className="rounded-xl border border-slate-800 bg-slate-900 p-4"
            // >
            //   <h3 className="font-semibold">
            //     {workspace.name}
            //   </h3>
            // </div>
            <li key={workspace._id} className="min-w-0">
              <Link
                to={`/workspaces/${workspace._id}`}
                className="workspace-card group surface-subtle flex h-full min-w-0 flex-col p-4 motion-safe:hover:-translate-y-0.5"
              >
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

                <span className="text-muted mt-4 flex items-center gap-1.5 text-xs font-medium">
                  <UsersIcon className="size-3.5" />
                  {workspace.members?.length ?? 0}{" "}
                  {workspace.members?.length === 1 ? "member" : "members"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default WorkspaceList;
