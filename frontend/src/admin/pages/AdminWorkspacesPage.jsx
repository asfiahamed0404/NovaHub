import { useEffect, useState } from "react";

import {
  adminApi,
  isAdminRequestCancelled,
} from "../api/adminApi.js";
import AdminDialog from "../components/AdminDialog.jsx";
import {
  AdminBadge,
  AdminDefinitionList,
  AdminEmpty,
  AdminError,
  AdminInlineLoading,
  AdminLoading,
  AdminPageHeader,
  AdminPagination,
} from "../components/AdminUi.jsx";
import {
  formatAdminDate,
  formatAdminNumber,
  getAdminEntityId,
  getAdminPagination,
  titleCase,
} from "../utils/adminFormat.js";
import useAdminAccessRecovery from "../hooks/useAdminAccessRecovery.js";

const PAGE_LIMIT = 20;

function AdminWorkspacesPage() {
  const recoverAdminAccess = useAdminAccessRecovery();
  const [draftSearch, setDraftSearch] = useState("");
  const [query, setQuery] = useState({ search: "", page: 1 });
  const [workspaces, setWorkspaces] = useState([]);
  const [pagination, setPagination] = useState(
    getAdminPagination(null, PAGE_LIMIT)
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [workspaceDetails, setWorkspaceDetails] = useState(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const [detailsReloadKey, setDetailsReloadKey] = useState(0);

  useEffect(() => {
    const abortController = new AbortController();

    const loadWorkspaces = async () => {
      try {
        setError("");
        setIsLoading(true);
        const data = await adminApi.listWorkspaces(
          {
            page: query.page,
            limit: PAGE_LIMIT,
            search: query.search,
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

        setWorkspaces(
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

    loadWorkspaces();

    return () => abortController.abort();
  }, [query, recoverAdminAccess, reloadKey]);

  useEffect(() => {
    if (!selectedWorkspaceId) {
      return undefined;
    }

    const abortController = new AbortController();

    const loadWorkspaceDetails = async () => {
      try {
        setDetailsError("");
        setIsLoadingDetails(true);
        setWorkspaceDetails(null);
        const data = await adminApi.getWorkspace(
          selectedWorkspaceId,
          { signal: abortController.signal }
        );

        if (abortController.signal.aborted) {
          return;
        }

        setWorkspaceDetails(data);
      } catch (requestError) {
        if (isAdminRequestCancelled(requestError)) {
          return;
        }

        if (await recoverAdminAccess(requestError)) {
          return;
        }

        setDetailsError(requestError.message);
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoadingDetails(false);
        }
      }
    };

    loadWorkspaceDetails();

    return () => abortController.abort();
  }, [detailsReloadKey, recoverAdminAccess, selectedWorkspaceId]);

  const handleSearch = (event) => {
    event.preventDefault();
    setQuery({ search: draftSearch.trim(), page: 1 });
  };

  const clearSearch = () => {
    setDraftSearch("");
    setQuery({ search: "", page: 1 });
  };

  const workspace = workspaceDetails?.workspace;

  return (
    <div>
      <AdminPageHeader
        eyebrow="Platform inventory"
        title="Workspaces"
        description="Inspect collaboration spaces, membership, and bounded activity without changing workspace content."
      />

      <section
        className="surface-panel mt-6 p-4 sm:p-5"
        aria-labelledby="workspace-filters-heading"
      >
        <h2 id="workspace-filters-heading" className="sr-only">
          Workspace filters
        </h2>
        <form
          onSubmit={handleSearch}
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <div className="min-w-0 flex-1">
            <label
              htmlFor="admin-workspace-search"
              className="form-label"
            >
              Search workspaces
            </label>
            <input
              id="admin-workspace-search"
              type="search"
              value={draftSearch}
              onChange={(event) => setDraftSearch(event.target.value)}
              placeholder="Workspace name"
              className="form-input mt-2"
            />
          </div>
          <button type="submit" className="button button-primary">
            Search
          </button>
          {query.search && (
            <button
              type="button"
              onClick={clearSearch}
              className="button button-secondary"
            >
              Clear
            </button>
          )}
        </form>
      </section>

      {isLoading && <AdminLoading label="Loading workspaces..." />}

      {!isLoading && error && (
        <AdminError
          message={error}
          onRetry={() => setReloadKey((key) => key + 1)}
        />
      )}

      {!isLoading && !error && (
        <section
          className="surface-panel mt-6 overflow-hidden"
          aria-labelledby="admin-workspaces-table-heading"
        >
          <div className="border-theme flex items-center justify-between gap-4 border-b px-5 py-4">
            <h2
              id="admin-workspaces-table-heading"
              className="text-heading font-semibold"
            >
              Platform workspaces
            </h2>
            <span className="meta-badge rounded-md px-2.5 py-1 text-xs font-semibold">
              {formatAdminNumber(pagination.total)} workspaces
            </span>
          </div>

          {workspaces.length === 0 ? (
            <div className="p-5">
              <AdminEmpty
                title="No workspaces found"
                description="Try a broader workspace-name search."
              />
            </div>
          ) : (
            <div className="scroll-area overflow-x-auto">
              <table className="admin-table min-w-[56rem]">
                <thead>
                  <tr>
                    <th scope="col">Workspace</th>
                    <th scope="col">Members</th>
                    <th scope="col">Messages</th>
                    <th scope="col">Memories</th>
                    <th scope="col">Created</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {workspaces.map((item) => (
                    <tr key={getAdminEntityId(item)}>
                      <td>
                        <p className="text-heading max-w-xs break-words font-semibold">
                          {item.name}
                        </p>
                        <p className="text-muted mt-1 max-w-xs line-clamp-2 break-words text-xs">
                          {item.description || "No description"}
                        </p>
                      </td>
                      <td>{formatAdminNumber(item.memberCount)}</td>
                      <td>{formatAdminNumber(item.messageCount)}</td>
                      <td>{formatAdminNumber(item.memoryCount)}</td>
                      <td>
                        {formatAdminDate(item.createdAt, { dateOnly: true })}
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedWorkspaceId(getAdminEntityId(item))
                          }
                          className="button button-secondary min-h-10 px-3"
                          aria-label={`View ${item.name}`}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
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

      {selectedWorkspaceId && (
        <AdminDialog
          title={workspace?.name || "Workspace details"}
          description="Read-only platform context with bounded members, message metadata, and approved memories."
          onClose={() => setSelectedWorkspaceId("")}
          size="wide"
        >
          {isLoadingDetails && (
            <AdminInlineLoading label="Loading workspace details..." />
          )}

          {!isLoadingDetails && detailsError && (
            <div>
              <p className="feedback feedback-error" role="alert">
                {detailsError}
              </p>
              <button
                type="button"
                onClick={() => setDetailsReloadKey((key) => key + 1)}
                className="button button-secondary mt-4"
              >
                Try again
              </button>
            </div>
          )}

          {!isLoadingDetails && !detailsError && workspace && (
            <div className="space-y-6">
              <AdminDefinitionList
                items={[
                  {
                    label: "Created",
                    value: formatAdminDate(workspace.createdAt),
                  },
                  {
                    label: "Created by",
                    value: workspace.createdBy
                      ? `${workspace.createdBy.name} (${workspace.createdBy.email})`
                      : "Unavailable account",
                  },
                  {
                    label: "Members",
                    value: formatAdminNumber(workspace.memberCount),
                  },
                  {
                    label: "Messages",
                    value: formatAdminNumber(workspace.messageCount),
                  },
                  {
                    label: "Memories",
                    value: formatAdminNumber(workspace.memoryCount),
                  },
                  {
                    label: "Updated",
                    value: formatAdminDate(workspace.updatedAt),
                  },
                ]}
              />

              <section aria-labelledby="workspace-description-heading">
                <h3
                  id="workspace-description-heading"
                  className="text-heading font-semibold"
                >
                  Description
                </h3>
                <p className="text-body mt-2 whitespace-pre-wrap break-words text-sm leading-6">
                  {workspace.description || "No description has been added."}
                </p>
              </section>

              <section aria-labelledby="workspace-members-detail-heading">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3
                    id="workspace-members-detail-heading"
                    className="text-heading font-semibold"
                  >
                    Members
                  </h3>
                  {workspaceDetails.membersTruncated && (
                    <AdminBadge tone="accent">Bounded list</AdminBadge>
                  )}
                </div>
                {workspaceDetails.members?.length ? (
                  <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                    {workspaceDetails.members.map((member) => (
                      <li
                        key={getAdminEntityId(member)}
                        className="surface-subtle min-w-0 p-3"
                      >
                        <p className="text-heading break-words text-sm font-semibold">
                          {member.name}
                        </p>
                        <p className="text-muted mt-1 break-all text-xs">
                          {member.email}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <AdminBadge
                            tone={
                              member.role === "admin" ? "accent" : "neutral"
                            }
                          >
                            {titleCase(member.role)}
                          </AdminBadge>
                          <AdminBadge
                            tone={
                              member.plan === "premium"
                                ? "accent"
                                : "neutral"
                            }
                          >
                            {titleCase(member.plan)}
                          </AdminBadge>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted mt-2 text-sm">
                    No members were returned for this workspace.
                  </p>
                )}
              </section>

              <section aria-labelledby="recent-message-metadata-heading">
                <h3
                  id="recent-message-metadata-heading"
                  className="text-heading font-semibold"
                >
                  Recent message metadata
                </h3>
                {workspaceDetails.recentMessages?.length ? (
                  <ul className="mt-3 space-y-3">
                    {workspaceDetails.recentMessages.map((message) => (
                      <li
                        key={getAdminEntityId(message)}
                        className="surface-subtle flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="text-heading break-words text-sm font-semibold">
                            {message.sender?.name || "Unavailable sender"}
                          </p>
                          <p className="text-muted mt-1 text-xs">
                            {titleCase(message.messageType, "Message")}
                          </p>
                        </div>
                        <time
                          dateTime={message.createdAt}
                          className="text-muted shrink-0 text-xs"
                        >
                          {formatAdminDate(message.createdAt)}
                        </time>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted mt-2 text-sm">
                    No recent message metadata is available.
                  </p>
                )}
              </section>

              <section aria-labelledby="recent-workspace-memories-heading">
                <h3
                  id="recent-workspace-memories-heading"
                  className="text-heading font-semibold"
                >
                  Recent memories
                </h3>
                {workspaceDetails.recentMemories?.length ? (
                  <ul className="mt-3 space-y-3">
                    {workspaceDetails.recentMemories.map((memory) => (
                      <li
                        key={getAdminEntityId(memory)}
                        className="surface-subtle p-3"
                      >
                        <div className="flex flex-wrap gap-2">
                          <AdminBadge tone="accent">
                            {titleCase(memory.type)}
                          </AdminBadge>
                          <AdminBadge>
                            {titleCase(memory.importance)}
                          </AdminBadge>
                        </div>
                        <p className="text-body mt-2 whitespace-pre-wrap break-words text-sm leading-6">
                          {memory.content}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted mt-2 text-sm">
                    No recent workspace memories are available.
                  </p>
                )}
              </section>
            </div>
          )}
        </AdminDialog>
      )}
    </div>
  );
}

export default AdminWorkspacesPage;
