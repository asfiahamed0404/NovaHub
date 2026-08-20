import { useAuth } from "../context/AuthContext.jsx";
import WorkspaceList from "../components/WorkspaceList.jsx";
import CreateWorkspaceForm from "../components/CreateWorkspaceForm.jsx";
import { useState } from "react";
import JoinWorkspaceForm from "../components/JoinWorkspaceForm.jsx";
import {
  InviteIcon,
  LogoutIcon,
} from "../components/Icons.jsx";
import NovaHubLogo from "../components/NovaHubLogo.jsx";
import ThemeSelector from "../components/ThemeSelector.jsx";

const isLegacyWorkspaceJoinEnabled =
  import.meta.env.VITE_ENABLE_LEGACY_WORKSPACE_JOIN ===
  "true";

function DashboardPage() {
  const { user, logout } = useAuth();
  const [workspaces, setWorkspaces] = useState([]);

  return (
    <div className="app-shell">
      <header className="app-header sticky top-0 z-20">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-3 sm:gap-4 sm:px-6">
          <NovaHubLogo />

          <div className="flex min-w-0 items-center gap-1 sm:gap-3">
            <div
              className="flex min-w-0 items-center gap-2.5"
              role="group"
              aria-label={`Signed in as ${user.name}, ${user.email}`}
            >
              <span
                className="profile-avatar hidden size-9 shrink-0 items-center justify-center rounded-[10px] text-sm font-semibold sm:flex"
                aria-hidden="true"
              >
                {user.name?.charAt(0).toUpperCase() || "N"}
              </span>

              <span
                className="hidden min-w-0 text-right md:block"
                aria-hidden="true"
              >
                <span className="text-heading block max-w-48 truncate text-sm font-semibold">
                  {user.name}
                </span>
                <span className="text-muted block max-w-48 truncate text-xs">
                  {user.email}
                </span>
              </span>
            </div>

            <ThemeSelector compact />

            <button
              type="button"
              onClick={logout}
              className="button button-secondary px-3 sm:px-4"
              aria-label="Log out of NovaHub"
            >
              <LogoutIcon className="size-4" />
              <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="page-enter mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <section
          className="border-theme flex flex-col gap-6 border-b pb-8 md:flex-row md:items-end md:justify-between"
          aria-labelledby="dashboard-heading"
        >
          <div className="min-w-0 max-w-2xl">
            <p className="eyebrow">
              Workspace overview
            </p>
            <h1
              id="dashboard-heading"
              className="text-heading mt-2 break-words text-3xl font-semibold tracking-[-0.035em] sm:text-4xl"
            >
              Welcome, {user.name}
            </h1>
            <p className="text-muted mt-3 max-w-xl text-sm leading-6 sm:text-base">
              Continue working with your teams or start a new place to
              collaborate.
            </p>
          </div>

          <dl className="surface-subtle grid min-w-0 gap-4 px-4 py-3 text-sm sm:grid-cols-2 md:min-w-[24rem]">
            <div className="min-w-0">
              <dt className="text-muted text-xs font-medium uppercase tracking-wide">
                Email
              </dt>
              <dd className="text-body mt-1 break-all font-medium">
                {user.email}
              </dd>
            </div>
            <div className="border-theme min-w-0 sm:border-l sm:pl-4">
              <dt className="text-muted text-xs font-medium uppercase tracking-wide">
                Profile status
              </dt>
              <dd className="text-body mt-1 break-words font-medium">
                {user.status}
              </dd>
            </div>
          </dl>
        </section>

        <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
          <WorkspaceList
            workspaces={workspaces}
            setWorkspaces={setWorkspaces}
          />

          <aside
            className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1"
            aria-label="Workspace actions"
          >
            <CreateWorkspaceForm
              onWorkspaceCreated={(newWorkspace) => {
                setWorkspaces((currentWorkspaces) => [
                  ...currentWorkspaces,
                  newWorkspace,
                ]);
              }}
            />

            <section
              className="surface-panel p-5 sm:p-6"
              aria-labelledby="secure-join-heading"
            >
              <span className="accent-tile flex size-9 items-center justify-center rounded-[10px]">
                <InviteIcon className="size-4" />
              </span>
              <h2
                id="secure-join-heading"
                className="text-heading mt-4 text-lg font-semibold tracking-[-0.015em]"
              >
                Joining a team?
              </h2>
              <p className="text-muted mt-2 text-sm leading-6">
                Ask a current member for a secure invitation link, then open
                it in this browser. You will review the workspace before
                explicitly accepting.
              </p>
            </section>

            {isLegacyWorkspaceJoinEnabled && (
              <JoinWorkspaceForm
                onWorkspaceJoined={(joinedWorkspace) => {
                  setWorkspaces((currentWorkspaces) => [
                    ...currentWorkspaces,
                    joinedWorkspace,
                  ]);
                }}
              />
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}

export default DashboardPage;
