import { useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../context/AuthContext.jsx";
import WorkspaceList from "../components/WorkspaceList.jsx";
import CreateWorkspaceForm from "../components/CreateWorkspaceForm.jsx";
import JoinWorkspaceForm from "../components/JoinWorkspaceForm.jsx";
import {
  ArrowRightIcon,
  InviteIcon,
  LogoutIcon,
  MessageIcon,
  PlusIcon,
  SparklesIcon,
  UsersIcon,
} from "../components/Icons.jsx";
import NovaHubLogo from "../components/NovaHubLogo.jsx";
import ThemeSelector from "../components/ThemeSelector.jsx";

const isLegacyWorkspaceJoinEnabled =
  import.meta.env.VITE_ENABLE_LEGACY_WORKSPACE_JOIN === "true";

function DashboardPage() {
  const { user, logout } = useAuth();
  const [workspaces, setWorkspaces] = useState([]);
  const firstName = user.name?.trim().split(/\s+/)[0] || "there";

  const focusCreate = () => {
    document.getElementById("workspace-name")?.focus({ preventScroll: true });
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches
      ? "instant"
      : "smooth";
    document
      .getElementById("create-workspace")
      ?.scrollIntoView({ behavior, block: "center" });
  };

  return (
    <div className="app-shell dashboard-shell">
      <a className="admin-skip-link" href="#dashboard-main">
        Skip to main content
      </a>
      <aside className="workspace-rail" aria-label="Main navigation">
        <Link to="/dashboard" className="rail-brand" aria-label="NovaHub home">
          <NovaHubLogo />
        </Link>
        <div className="rail-team">
          <span className="rail-team-avatar">
            {user.name?.charAt(0).toUpperCase() || "N"}
          </span>
          <div>
            <strong>My workspace hub</strong>
            <span>Personal account</span>
          </div>
        </div>
        <p className="rail-label">WORKSPACE</p>
        <nav className="rail-nav">
          <Link
            to="/dashboard"
            className="rail-link is-active"
            aria-current="page"
          >
            <MessageIcon />
            Overview
          </Link>
          <a href="#workspaces-heading" className="rail-link">
            <UsersIcon />
            Your workspaces
          </a>
          <button type="button" onClick={focusCreate} className="rail-link">
            <PlusIcon />
            Create workspace
          </button>
          {user.role === "admin" && (
            <Link
              to="/admin"
              className="rail-link"
              aria-label="Open NovaHub Admin Console"
            >
              <UsersIcon />
              Admin console
            </Link>
          )}
        </nav>
        <div className="rail-note">
          <SparklesIcon className="size-5" />
          <strong>A little less catching up.</strong>
          <p>
            Find answers and turn conversations into clarity with Ask Nova,
            inside any workspace.
          </p>
        </div>
        <div className="rail-account">
          <span className="rail-team-avatar">
            {user.name?.charAt(0).toUpperCase() || "N"}
          </span>
          <div>
            <strong>{user.name}</strong>
            <span>{user.email}</span>
          </div>
          <button
            type="button"
            onClick={logout}
            aria-label="Log out of NovaHub"
            title="Log out"
            className="rail-logout"
          >
            <LogoutIcon />
          </button>
        </div>
      </aside>

      <div className="dashboard-body">
        <header className="dashboard-topbar">
          <span className="text-muted text-sm">
            <span className="text-heading font-medium">Workspace</span>
            <span className="mx-3 opacity-40">/</span>Overview
          </span>
          <ThemeSelector compact />
        </header>
        <main id="dashboard-main" className="page-enter dashboard-main">
          <section
            className="dashboard-heading"
            aria-labelledby="dashboard-heading"
          >
            <div>
              <p className="eyebrow">YOUR TEAM, IN SYNC</p>
              <h1 id="dashboard-heading">
                Good to see you, {firstName}
                <span className="text-accent">.</span>
              </h1>
              <p className="text-muted">
                A little more focus. A lot more progress. Pick up where your
                team left off.
              </p>
            </div>
            <button
              className="button button-primary"
              onClick={focusCreate}
              type="button"
            >
              <PlusIcon />
              New workspace
            </button>
          </section>

          <section
            className="dashboard-feature"
            aria-labelledby="feature-heading"
          >
            <div className="feature-copy">
              <span className="feature-kicker">
                <SparklesIcon />
                BUILT FOR BETTER TEAMWORK
              </span>
              <h2 id="feature-heading">
                Great work starts with
                <br />a shared conversation.
              </h2>
              <p>
                Bring your people, ideas, and decisions together.
                <br className="hidden sm:block" /> Nova helps you keep the
                context.
              </p>
              <a href="#workspaces-heading" className="feature-link">
                Explore your workspaces <ArrowRightIcon />
              </a>
            </div>
            <div className="feature-art" aria-hidden="true">
              <div className="orbit orbit-one" />
              <div className="orbit orbit-two" />
              <span className="orbit-core">
                <SparklesIcon className="size-9" />
              </span>
              <span className="orbit-chip chip-conversation">
                <MessageIcon />
                Conversations
              </span>
              <span className="orbit-chip chip-context">
                <SparklesIcon />
                Shared context
              </span>
              <span className="orbit-chip chip-team">
                <UsersIcon />
                Your people
              </span>
              <span className="orbit-dot dot-one" />
              <span className="orbit-dot dot-two" />
            </div>
          </section>

          <div className="dashboard-content">
            <WorkspaceList
              workspaces={workspaces}
              setWorkspaces={setWorkspaces}
            />
            <aside className="dashboard-actions" aria-label="Workspace actions">
              <div id="create-workspace">
                <CreateWorkspaceForm
                  onWorkspaceCreated={(workspace) =>
                    setWorkspaces((current) => [...current, workspace])
                  }
                />
              </div>
              <section
                className="join-note"
                aria-labelledby="secure-join-heading"
              >
                <InviteIcon className="size-5" />
                <div>
                  <h2 id="secure-join-heading">Already part of a team?</h2>
                  <p>
                    Open an invitation link from a teammate to review and join
                    their workspace.
                  </p>
                </div>
              </section>
              {isLegacyWorkspaceJoinEnabled && (
                <JoinWorkspaceForm
                  onWorkspaceJoined={(workspace) =>
                    setWorkspaces((current) => [...current, workspace])
                  }
                />
              )}
            </aside>
          </div>
          <footer className="dashboard-footer">
            <span>Made for conversations that move work forward.</span>
            <span>NovaHub · Your collaboration space</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
export default DashboardPage;
