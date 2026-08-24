import { useEffect, useState } from "react";

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
  AdminPagination,
} from "../components/AdminUi.jsx";
import {
  formatAdminDate,
  formatAdminNumber,
  getAdminEntityId,
  getAdminPagination,
  getAdminUsageStatus,
  titleCase,
} from "../utils/adminFormat.js";
import useAdminAccessRecovery from "../hooks/useAdminAccessRecovery.js";

const PAGE_LIMIT = 20;

function getStatusTone(status) {
  if (status === "rate-limited") {
    return "danger";
  }

  if (status === "near-limit") {
    return "accent";
  }

  return "success";
}

function AdminAiUsagePage() {
  const recoverAdminAccess = useAdminAccessRecovery();
  const [draftSearch, setDraftSearch] = useState("");
  const [query, setQuery] = useState({
    search: "",
    plan: "",
    page: 1,
  });
  const [usageItems, setUsageItems] = useState([]);
  const [pagination, setPagination] = useState(
    getAdminPagination(null, PAGE_LIMIT)
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const abortController = new AbortController();

    const loadAiUsage = async () => {
      try {
        setError("");
        setIsLoading(true);
        const data = await adminApi.listAiUsage(
          {
            page: query.page,
            limit: PAGE_LIMIT,
            search: query.search,
            plan: query.plan,
          },
          { signal: abortController.signal }
        );

        if (abortController.signal.aborted) {
          return;
        }

        const nextPagination = getAdminPagination(
          data.pagination,
          PAGE_LIMIT
        );

        if (query.page !== nextPagination.page) {
          setPagination(nextPagination);
          setQuery((currentQuery) => ({
            ...currentQuery,
            page: nextPagination.page,
          }));
          return;
        }

        setUsageItems(
          Array.isArray(data.items) ? data.items : []
        );
        setPagination(nextPagination);
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

    loadAiUsage();

    return () => abortController.abort();
  }, [query, recoverAdminAccess, reloadKey]);

  const handleSearch = (event) => {
    event.preventDefault();
    setQuery((currentQuery) => ({
      ...currentQuery,
      search: draftSearch.trim(),
      page: 1,
    }));
  };

  const clearFilters = () => {
    setDraftSearch("");
    setQuery({ search: "", plan: "", page: 1 });
  };

  return (
    <div>
      <AdminPageHeader
        eyebrow="AI governance"
        title="AI Usage"
        description="Current active rate-limit windows for the shared user-level AI quota used by Catch Me Up and Ask Nova. This is not feature-level analytics or historical billing data."
      />

      <section
        className="surface-panel mt-6 p-4 sm:p-5"
        aria-labelledby="ai-usage-filters-heading"
      >
        <h2 id="ai-usage-filters-heading" className="sr-only">
          AI usage filters
        </h2>
        <form
          onSubmit={handleSearch}
          className="grid gap-3 sm:grid-cols-[minmax(13rem,1fr)_10rem_auto]"
        >
          <div>
            <label htmlFor="admin-ai-search" className="form-label">
              Search users
            </label>
            <input
              id="admin-ai-search"
              type="search"
              value={draftSearch}
              onChange={(event) => setDraftSearch(event.target.value)}
              placeholder="Name or email"
              className="form-input mt-2"
            />
          </div>

          <div>
            <label htmlFor="admin-ai-plan" className="form-label">
              Plan
            </label>
            <select
              id="admin-ai-plan"
              value={query.plan}
              onChange={(event) =>
                setQuery((currentQuery) => ({
                  ...currentQuery,
                  search: draftSearch.trim(),
                  plan: event.target.value,
                  page: 1,
                }))
              }
              className="form-input mt-2"
            >
              <option value="">All plans</option>
              <option value="free">Free</option>
              <option value="premium">Premium</option>
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button type="submit" className="button button-primary flex-1">
              Search
            </button>
            {(query.search || query.plan) && (
              <button
                type="button"
                onClick={clearFilters}
                className="button button-secondary px-3"
              >
                Clear
              </button>
            )}
          </div>
        </form>
      </section>

      <aside className="surface-subtle mt-4 p-4 text-sm leading-6">
        <p className="text-body">
          <span className="font-semibold">Scope:</span> one active quota window
          per user. Requests from NovaHub AI features share the same count, so
          this view intentionally does not attribute calls to individual
          features.
        </p>
      </aside>

      {isLoading && <AdminLoading label="Loading AI usage..." />}

      {!isLoading && error && (
        <AdminError
          message={error}
          onRetry={() => setReloadKey((key) => key + 1)}
        />
      )}

      {!isLoading && !error && (
        <section
          className="surface-panel mt-6 overflow-hidden"
          aria-labelledby="admin-ai-usage-table-heading"
        >
          <div className="border-theme flex items-center justify-between gap-4 border-b px-5 py-4">
            <h2
              id="admin-ai-usage-table-heading"
              className="text-heading font-semibold"
            >
              Active usage windows
            </h2>
            <span className="meta-badge rounded-md px-2.5 py-1 text-xs font-semibold">
              {formatAdminNumber(pagination.total)} active
            </span>
          </div>

          {usageItems.length === 0 ? (
            <div className="p-5">
              <AdminEmpty
                title="No active AI usage found"
                description="Users without an active quota window are correctly omitted from this view."
              />
            </div>
          ) : (
            <div className="scroll-area overflow-x-auto">
              <table className="admin-table min-w-[62rem]">
                <thead>
                  <tr>
                    <th scope="col">User</th>
                    <th scope="col">Plan</th>
                    <th scope="col">Usage</th>
                    <th scope="col">Window</th>
                    <th scope="col">Reset</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {usageItems.map((item) => {
                    const status = getAdminUsageStatus(item);
                    const requestCount = Number(item.requestCount) || 0;
                    const limit = Number(item.limit) || 0;
                    const percentage =
                      limit > 0
                        ? Math.min(100, Math.round((requestCount / limit) * 100))
                        : 0;

                    return (
                      <tr
                        key={
                          getAdminEntityId(item) ||
                          getAdminEntityId(item.user)
                        }
                      >
                        <td>
                          <p className="text-heading font-semibold">
                            {item.user?.name || "Unavailable user"}
                          </p>
                          <p className="text-muted mt-1 break-all text-xs">
                            {item.user?.email || "No email available"}
                          </p>
                        </td>
                        <td>
                          <AdminBadge
                            tone={
                              item.plan === "premium" ? "accent" : "neutral"
                            }
                          >
                            {titleCase(item.plan)}
                          </AdminBadge>
                        </td>
                        <td>
                          <div className="min-w-32">
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="text-body font-semibold">
                                {formatAdminNumber(requestCount)} / {formatAdminNumber(limit)}
                              </span>
                              <span className="text-muted">{percentage}%</span>
                            </div>
                            <div
                              className="admin-progress-track mt-2"
                              role="progressbar"
                              aria-label={`AI quota used by ${
                                item.user?.name || "user"
                              }`}
                              aria-valuemin="0"
                              aria-valuemax={limit}
                              aria-valuenow={Math.min(
                                Math.max(0, requestCount),
                                Math.max(0, limit)
                              )}
                            >
                              <div
                                className="admin-progress-value"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td>
                          {formatAdminNumber(item.windowMinutes)} minutes
                        </td>
                        <td>
                          <time dateTime={item.resetAt}>
                            {formatAdminDate(item.resetAt)}
                          </time>
                        </td>
                        <td>
                          <AdminBadge tone={getStatusTone(status)}>
                            {titleCase(status)}
                          </AdminBadge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <AdminPagination
            pagination={pagination}
            onPageChange={(page) =>
              setQuery((currentQuery) => ({
                ...currentQuery,
                page,
              }))
            }
          />
        </section>
      )}
    </div>
  );
}

export default AdminAiUsagePage;
