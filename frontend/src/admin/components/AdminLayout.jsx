import { Link, NavLink, Outlet } from "react-router";

import {
  ArrowLeftIcon,
  LogoutIcon,
} from "../../components/Icons.jsx";
import NovaHubLogo from "../../components/NovaHubLogo.jsx";
import ThemeSelector from "../../components/ThemeSelector.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { getAdminInitials } from "../utils/adminFormat.js";

const ADMIN_NAV_ITEMS = [
  { to: "/admin", label: "Overview", end: true },
  { to: "/admin/users", label: "Users" },
  { to: "/admin/workspaces", label: "Workspaces" },
  { to: "/admin/ai-usage", label: "AI Usage" },
  { to: "/admin/memories", label: "Memories" },
];

function AdminLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <a
        href="#admin-main-content"
        className="admin-skip-link"
      >
        Skip to admin content
      </a>

      <div className="mx-auto min-h-[100dvh] w-full max-w-[96rem] lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="admin-sidebar border-theme border-b px-4 py-4 sm:px-6 lg:sticky lg:top-0 lg:flex lg:h-[100dvh] lg:flex-col lg:overflow-y-auto lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <NovaHubLogo />
              <p className="text-accent mt-2 pl-12 text-xs font-semibold uppercase tracking-[0.14em]">
                Admin Console
              </p>
            </div>
            <div className="lg:hidden">
              <ThemeSelector compact />
            </div>
          </div>

          <nav
            className="scroll-area mt-5 overflow-x-auto pb-2 lg:mt-8 lg:overflow-visible lg:pb-0"
            aria-label="Admin sections"
          >
            <div className="flex min-w-max gap-2 lg:min-w-0 lg:flex-col">
              {ADMIN_NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `admin-nav-link ${
                      isActive ? "admin-nav-link-active" : ""
                    }`
                  }
                >
                  <span
                    className="admin-nav-indicator"
                    aria-hidden="true"
                  />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </nav>

          <div className="border-theme mt-4 grid gap-3 border-t pt-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center lg:mt-auto lg:grid-cols-1 lg:items-stretch lg:pt-5">
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="profile-avatar flex size-9 shrink-0 items-center justify-center rounded-[10px] text-xs font-semibold"
                aria-hidden="true"
              >
                {getAdminInitials(user.name, user.email)}
              </span>
              <span className="min-w-0">
                <span className="text-accent block text-[0.6875rem] font-semibold uppercase tracking-wide">
                  Admin account
                </span>
                <span className="text-heading block truncate text-sm font-semibold">
                  {user.name}
                </span>
                <span className="text-muted block truncate text-xs">
                  {user.email}
                </span>
              </span>
            </div>

            <div className="hidden lg:block">
              <ThemeSelector compact />
            </div>

            <Link
              to="/dashboard"
              className="button button-secondary min-h-10 px-3"
            >
              <ArrowLeftIcon className="size-4" />
              <span>Back to NovaHub</span>
            </Link>

            <button
              type="button"
              onClick={logout}
              className="button button-secondary min-h-10 px-3"
            >
              <LogoutIcon className="size-4" />
              <span>Log out</span>
            </button>
          </div>
        </aside>

        <main
          id="admin-main-content"
          tabIndex={-1}
          className="page-enter min-w-0 px-4 py-7 sm:px-6 sm:py-9 lg:px-8 lg:py-10 xl:px-10"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;
