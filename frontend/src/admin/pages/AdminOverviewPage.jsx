import { useEffect, useState } from "react";
import { Link } from "react-router";

import {
  adminApi,
  isAdminRequestCancelled,
} from "../api/adminApi.js";
import {
  AdminBadge,
  AdminEmpty,
  AdminError,
  AdminLoading,
  AdminPageHeader,
} from "../components/AdminUi.jsx";
import {
  formatAdminDate,
  formatAdminNumber,
  getAdminEntityId,
  titleCase,
} from "../utils/adminFormat.js";
import useAdminAccessRecovery from "../hooks/useAdminAccessRecovery.js";

const KPI_ITEMS = [
  { key: "users", label: "Total Users" },
  { key: "workspaces", label: "Total Workspaces" },
  { key: "messages", label: "Total Messages" },
  { key: "memories", label: "Workspace Memories" },
];

function DistributionCard({ title, values }) {
  const entries = Object.entries(values || {});
  const total = entries.reduce(
    (sum, [, value]) => sum + (Number(value) || 0),
    0
  );

  return (
    <section className="surface-panel p-5 sm:p-6">
      <h2 className="text-heading text-lg font-semibold">{title}</h2>
      {entries.length === 0 ? (
        <p className="text-muted mt-4 text-sm">
          No distribution data is available yet.
        </p>
      ) : (
        <ul className="mt-5 space-y-4">
          {entries.map(([label, count]) => {
            const numericCount = Number(count) || 0;
            const percentage =
              total > 0 ? Math.round((numericCount / total) * 100) : 0;

            return (
              <li key={label}>
                <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                  <span className="text-body font-medium">
                    {titleCase(label)}
                  </span>
                  <span className="text-muted">
                    {formatAdminNumber(numericCount)} ({percentage}%)
                  </span>
                </div>
                <div
                  className="admin-progress-track"
                  role="img"
                  aria-label={`${titleCase(label)}: ${percentage}%`}
                >
                  <div
                    className="admin-progress-value"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function RecentUsers({ users }) {
  return (
    <section className="surface-panel overflow-hidden">
      <div className="border-theme flex items-center justify-between gap-4 border-b px-5 py-4">
        <h2 className="text-heading font-semibold">Recent Users</h2>
        <Link to="/admin/users" className="auth-link text-sm font-semibold">
          View all
        </Link>
      </div>
      {users.length === 0 ? (
        <div className="p-5">
          <AdminEmpty
            title="No users yet"
            description="New platform accounts will appear here."
          />
        </div>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {users.map((user) => (
            <li
              key={getAdminEntityId(user)}
              className="flex min-w-0 items-start justify-between gap-4 px-5 py-4"
            >
              <div className="min-w-0">
                <p className="text-heading truncate text-sm font-semibold">
                  {user.name}
                </p>
                <p className="text-muted mt-1 truncate text-xs">
                  {user.email}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-2">
                <AdminBadge tone={user.role === "admin" ? "accent" : "neutral"}>
                  {titleCase(user.role)}
                </AdminBadge>
                <AdminBadge tone={user.plan === "premium" ? "accent" : "neutral"}>
                  {titleCase(user.plan)}
                </AdminBadge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RecentWorkspaces({ workspaces }) {
  return (
    <section className="surface-panel overflow-hidden">
      <div className="border-theme flex items-center justify-between gap-4 border-b px-5 py-4">
        <h2 className="text-heading font-semibold">Recent Workspaces</h2>
        <Link
          to="/admin/workspaces"
          className="auth-link text-sm font-semibold"
        >
          View all
        </Link>
      </div>
      {workspaces.length === 0 ? (
        <div className="p-5">
          <AdminEmpty
            title="No workspaces yet"
            description="New collaboration spaces will appear here."
          />
        </div>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {workspaces.map((workspace) => (
            <li key={getAdminEntityId(workspace)} className="px-5 py-4">
              <p className="text-heading break-words text-sm font-semibold">
                {workspace.name}
              </p>
              <p className="text-muted mt-1 text-xs">
                Created {formatAdminDate(workspace.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RecentMemories({ memories }) {
  return (
    <section className="surface-panel overflow-hidden">
      <div className="border-theme flex items-center justify-between gap-4 border-b px-5 py-4">
        <h2 className="text-heading font-semibold">Recent Memories</h2>
        <Link
          to="/admin/memories"
          className="auth-link text-sm font-semibold"
        >
          View all
        </Link>
      </div>
      {memories.length === 0 ? (
        <div className="p-5">
          <AdminEmpty
            title="No workspace memories yet"
            description="Approved durable workspace context will appear here."
          />
        </div>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {memories.map((memory) => (
            <li key={getAdminEntityId(memory)} className="px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <AdminBadge tone="accent">
                  {titleCase(memory.type)}
                </AdminBadge>
                <span className="text-muted text-xs">
                  {memory.workspace?.name || "Unavailable workspace"}
                </span>
              </div>
              <p className="text-body mt-2 line-clamp-2 whitespace-pre-wrap break-words text-sm leading-6">
                {memory.content}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AdminOverviewPage() {
  const recoverAdminAccess = useAdminAccessRecovery();
  const [dashboard, setDashboard] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const abortController = new AbortController();

    const loadDashboard = async () => {
      try {
        setError("");
        setIsLoading(true);
        const data = await adminApi.getDashboard({
          signal: abortController.signal,
        });

        if (abortController.signal.aborted) {
          return;
        }

        setDashboard(data);
      } catch (requestError) {
        if (isAdminRequestCancelled(requestError)) {
          return;
        }

        if (await recoverAdminAccess(requestError)) {
          return;
        }

        setError(requestError.message);
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    loadDashboard();

    return () => abortController.abort();
  }, [recoverAdminAccess, reloadKey]);

  return (
    <div>
      <AdminPageHeader
        eyebrow="Platform administration"
        title="Overview"
        description="A focused view of NovaHub accounts, collaboration activity, AI governance, and durable workspace context."
      />

      {isLoading && (
        <AdminLoading label="Loading admin overview..." />
      )}

      {!isLoading && error && (
        <AdminError
          message={error}
          onRetry={() => setReloadKey((key) => key + 1)}
        />
      )}

      {!isLoading && !error && dashboard && (
        <>
          <section
            className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
            aria-label="Platform statistics"
          >
            {KPI_ITEMS.map((item) => (
              <article key={item.key} className="surface-panel p-5 sm:p-6">
                <p className="text-muted text-sm font-medium">
                  {item.label}
                </p>
                <p className="text-heading mt-3 text-3xl font-semibold tracking-[-0.03em]">
                  {formatAdminNumber(dashboard.stats?.[item.key])}
                </p>
              </article>
            ))}
          </section>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <DistributionCard
              title="Users by Plan"
              values={dashboard.usersByPlan}
            />
            <DistributionCard
              title="Users by Role"
              values={dashboard.usersByRole}
            />
          </div>

          <div className="mt-6 grid items-start gap-6 xl:grid-cols-3">
            <RecentUsers users={dashboard.recentUsers || []} />
            <RecentWorkspaces
              workspaces={dashboard.recentWorkspaces || []}
            />
            <RecentMemories
              memories={dashboard.recentMemories || []}
            />
          </div>
        </>
      )}
    </div>
  );
}

export default AdminOverviewPage;
