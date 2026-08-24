import { useEffect, useRef, useState } from "react";

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

function getImportanceTone(importance) {
  if (importance === "high") {
    return "danger";
  }

  if (importance === "normal") {
    return "accent";
  }

  return "neutral";
}

function AdminMemoriesPage() {
  const recoverAdminAccess = useAdminAccessRecovery();
  const deleteConfirmButtonRef = useRef(null);
  const memoryPageHeadingRef = useRef(null);
  const [draftSearch, setDraftSearch] = useState("");
  const [draftWorkspaceId, setDraftWorkspaceId] = useState("");
  const [query, setQuery] = useState({
    search: "",
    type: "",
    importance: "",
    workspaceId: "",
    page: 1,
  });
  const [memories, setMemories] = useState([]);
  const [pagination, setPagination] = useState(
    getAdminPagination(null, PAGE_LIMIT)
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [actionMessage, setActionMessage] = useState("");

  const [selectedMemory, setSelectedMemory] = useState(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    const abortController = new AbortController();

    const loadMemories = async () => {
      try {
        setError("");
        setIsLoading(true);
        const data = await adminApi.listMemories(
          {
            page: query.page,
            limit: PAGE_LIMIT,
            search: query.search,
            type: query.type,
            importance: query.importance,
            workspaceId: query.workspaceId,
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

        setMemories(Array.isArray(data.items) ? data.items : []);
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

    loadMemories();

    return () => abortController.abort();
  }, [query, recoverAdminAccess, reloadKey]);

  const handleSearch = (event) => {
    event.preventDefault();
    setActionMessage("");
    setQuery((currentQuery) => ({
      ...currentQuery,
      search: draftSearch.trim(),
      workspaceId: draftWorkspaceId.trim(),
      page: 1,
    }));
  };

  const clearFilters = () => {
    setDraftSearch("");
    setDraftWorkspaceId("");
    setActionMessage("");
    setQuery({
      search: "",
      type: "",
      importance: "",
      workspaceId: "",
      page: 1,
    });
  };

  const openMemory = (memory, confirmDelete = false) => {
    setSelectedMemory(memory);
    setIsConfirmingDelete(confirmDelete);
    setDeleteError("");
  };

  const closeMemory = () => {
    if (isDeleting) {
      return;
    }

    setSelectedMemory(null);
    setIsConfirmingDelete(false);
    setDeleteError("");
  };

  const deleteMemory = async () => {
    if (!selectedMemory || isDeleting) {
      return;
    }

    const memoryId = getAdminEntityId(selectedMemory);

    try {
      setDeleteError("");
      setIsDeleting(true);
      const response = await adminApi.deleteMemory(memoryId);

      setMemories((currentMemories) =>
        currentMemories.filter(
          (memory) => getAdminEntityId(memory) !== memoryId
        )
      );
      setActionMessage(
        response.message || "The workspace memory was deleted."
      );
      setPagination((currentPagination) =>
        getAdminPagination(
          {
            ...currentPagination,
            total: Math.max(0, currentPagination.total - 1),
            pages: Math.max(
              1,
              Math.ceil(
                Math.max(0, currentPagination.total - 1) /
                  currentPagination.limit
              )
            ),
          },
          PAGE_LIMIT
        )
      );
      setSelectedMemory(null);
      setIsConfirmingDelete(false);

      if (memories.length === 1 && query.page > 1) {
        setQuery((currentQuery) => ({
          ...currentQuery,
          page: currentQuery.page - 1,
        }));
      }
    } catch (requestError) {
      if (await recoverAdminAccess(requestError)) {
        return;
      }

      setDeleteError(requestError.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const hasFilters =
    query.search ||
    query.type ||
    query.importance ||
    query.workspaceId;

  return (
    <div>
      <AdminPageHeader
        headingRef={memoryPageHeadingRef}
        eyebrow="AI memory governance"
        title="Workspace Memories"
        description="Review approved durable workspace context and remove an incorrect memory without changing its source messages."
      />

      <section
        className="surface-panel mt-6 p-4 sm:p-5"
        aria-labelledby="memory-filters-heading"
      >
        <h2 id="memory-filters-heading" className="sr-only">
          Workspace memory filters
        </h2>
        <form
          onSubmit={handleSearch}
          className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(12rem,1fr)_9rem_9rem_minmax(12rem,0.8fr)_auto]"
        >
          <div>
            <label htmlFor="admin-memory-search" className="form-label">
              Search memories
            </label>
            <input
              id="admin-memory-search"
              type="search"
              value={draftSearch}
              onChange={(event) => setDraftSearch(event.target.value)}
              placeholder="Memory content"
              className="form-input mt-2"
            />
          </div>

          <div>
            <label htmlFor="admin-memory-type" className="form-label">
              Type
            </label>
            <select
              id="admin-memory-type"
              value={query.type}
              onChange={(event) =>
                setQuery((currentQuery) => ({
                  ...currentQuery,
                  search: draftSearch.trim(),
                  workspaceId: draftWorkspaceId.trim(),
                  type: event.target.value,
                  page: 1,
                }))
              }
              className="form-input mt-2"
            >
              <option value="">All types</option>
              <option value="fact">Fact</option>
              <option value="decision">Decision</option>
              <option value="task">Task</option>
              <option value="note">Note</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="admin-memory-importance"
              className="form-label"
            >
              Importance
            </label>
            <select
              id="admin-memory-importance"
              value={query.importance}
              onChange={(event) =>
                setQuery((currentQuery) => ({
                  ...currentQuery,
                  search: draftSearch.trim(),
                  workspaceId: draftWorkspaceId.trim(),
                  importance: event.target.value,
                  page: 1,
                }))
              }
              className="form-input mt-2"
            >
              <option value="">All levels</option>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="admin-memory-workspace"
              className="form-label"
            >
              Workspace ID
            </label>
            <input
              id="admin-memory-workspace"
              type="search"
              value={draftWorkspaceId}
              onChange={(event) =>
                setDraftWorkspaceId(event.target.value)
              }
              placeholder="Optional workspace ID"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="form-input mt-2"
            />
          </div>

          <div className="flex items-end gap-2 md:col-span-2 xl:col-span-1">
            <button type="submit" className="button button-primary flex-1">
              Search
            </button>
            {hasFilters && (
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

      {actionMessage && (
        <p className="feedback feedback-success mt-4" role="status">
          {actionMessage}
        </p>
      )}

      {isLoading && (
        <AdminLoading label="Loading workspace memories..." />
      )}

      {!isLoading && error && (
        <AdminError
          message={error}
          onRetry={() => setReloadKey((key) => key + 1)}
        />
      )}

      {!isLoading && !error && (
        <section
          className="surface-panel mt-6 overflow-hidden"
          aria-labelledby="admin-memories-table-heading"
        >
          <div className="border-theme flex items-center justify-between gap-4 border-b px-5 py-4">
            <h2
              id="admin-memories-table-heading"
              className="text-heading font-semibold"
            >
              Approved memories
            </h2>
            <span className="meta-badge rounded-md px-2.5 py-1 text-xs font-semibold">
              {formatAdminNumber(pagination.total)} memories
            </span>
          </div>

          {memories.length === 0 ? (
            <div className="p-5">
              <AdminEmpty
                title="No memories found"
                description="Try broader content, type, importance, or workspace filters."
              />
            </div>
          ) : (
            <div className="scroll-area overflow-x-auto">
              <table className="admin-table min-w-[72rem]">
                <thead>
                  <tr>
                    <th scope="col">Workspace</th>
                    <th scope="col">Type</th>
                    <th scope="col">Memory</th>
                    <th scope="col">Importance</th>
                    <th scope="col">Created By</th>
                    <th scope="col">Sources</th>
                    <th scope="col">Created</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {memories.map((memory) => (
                    <tr key={getAdminEntityId(memory)}>
                      <td className="max-w-52">
                        <p className="text-heading break-words font-semibold">
                          {memory.workspace?.name || "Unavailable workspace"}
                        </p>
                        <code className="text-muted mt-1 block select-all break-all text-[0.6875rem]">
                          {getAdminEntityId(memory.workspace) ||
                            "Unavailable workspace ID"}
                        </code>
                      </td>
                      <td>
                        <AdminBadge tone="accent">
                          {titleCase(memory.type)}
                        </AdminBadge>
                      </td>
                      <td>
                        <p className="max-w-sm line-clamp-3 whitespace-pre-wrap break-words leading-6">
                          {memory.content}
                        </p>
                      </td>
                      <td>
                        <AdminBadge
                          tone={getImportanceTone(memory.importance)}
                        >
                          {titleCase(memory.importance)}
                        </AdminBadge>
                      </td>
                      <td>
                        <p>{memory.createdBy?.name || "Unavailable user"}</p>
                        {memory.createdBy?.email && (
                          <p className="text-muted mt-1 break-all text-xs">
                            {memory.createdBy.email}
                          </p>
                        )}
                      </td>
                      <td>
                        {formatAdminNumber(memory.sourceMessageIdsCount)}
                      </td>
                      <td>
                        {formatAdminDate(memory.createdAt, { dateOnly: true })}
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => openMemory(memory)}
                            className="button button-secondary min-h-10 px-3"
                            aria-label={`View ${titleCase(memory.type)} memory`}
                          >
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => openMemory(memory, true)}
                            className="button button-danger min-h-10 px-3"
                            aria-label={`Delete ${titleCase(memory.type)} memory`}
                          >
                            Delete
                          </button>
                        </div>
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

      {selectedMemory && (
        <AdminDialog
          title={`${titleCase(selectedMemory.type)} memory`}
          description="Approved durable context stored for this workspace."
          onClose={closeMemory}
          isBusy={isDeleting}
          size="large"
          initialFocusRef={
            isConfirmingDelete ? deleteConfirmButtonRef : undefined
          }
          returnFocusRef={memoryPageHeadingRef}
        >
          <div className="space-y-5">
            <AdminDefinitionList
              items={[
                {
                  label: "Workspace",
                  value:
                    selectedMemory.workspace?.name ||
                    "Unavailable workspace",
                },
                {
                  label: "Workspace ID",
                  value: (
                    <code className="select-all break-all text-xs">
                      {getAdminEntityId(selectedMemory.workspace) ||
                        "Unavailable workspace ID"}
                    </code>
                  ),
                },
                {
                  label: "Type",
                  value: titleCase(selectedMemory.type),
                },
                {
                  label: "Importance",
                  value: titleCase(selectedMemory.importance),
                },
                {
                  label: "Created by",
                  value: selectedMemory.createdBy
                    ? `${selectedMemory.createdBy.name} (${selectedMemory.createdBy.email})`
                    : "Unavailable user",
                },
                {
                  label: "Source messages",
                  value: formatAdminNumber(
                    selectedMemory.sourceMessageIdsCount
                  ),
                },
                {
                  label: "Created",
                  value: formatAdminDate(selectedMemory.createdAt),
                },
              ]}
            />

            <section aria-labelledby="admin-memory-content-heading">
              <h3
                id="admin-memory-content-heading"
                className="text-heading font-semibold"
              >
                Memory content
              </h3>
              <p className="surface-subtle text-body mt-3 whitespace-pre-wrap break-words p-4 text-sm leading-7">
                {selectedMemory.content}
              </p>
            </section>

            <div className="border-theme border-t pt-5">
              {!isConfirmingDelete ? (
                <button
                  type="button"
                  onClick={() => setIsConfirmingDelete(true)}
                  className="button button-danger"
                >
                  Delete memory
                </button>
              ) : (
                <div
                  className="surface-subtle p-4"
                  role="group"
                  aria-label="Confirm memory deletion"
                >
                  <h3 className="text-heading text-sm font-semibold">
                    Permanently delete this memory?
                  </h3>
                  <p className="text-muted mt-2 text-sm leading-6">
                    This removes exactly this durable memory. Its source
                    messages and the workspace remain unchanged.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      ref={deleteConfirmButtonRef}
                      type="button"
                      onClick={deleteMemory}
                      disabled={isDeleting}
                      className="button button-danger"
                      aria-busy={isDeleting}
                    >
                      {isDeleting && (
                        <span className="spinner" aria-hidden="true" />
                      )}
                      {isDeleting ? "Deleting..." : "Confirm delete"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsConfirmingDelete(false);
                        setDeleteError("");
                      }}
                      disabled={isDeleting}
                      className="button button-secondary"
                    >
                      Keep memory
                    </button>
                  </div>
                </div>
              )}

              {deleteError && (
                <p className="feedback feedback-error mt-4" role="alert">
                  {deleteError}
                </p>
              )}
            </div>
          </div>
        </AdminDialog>
      )}
    </div>
  );
}

export default AdminMemoriesPage;
