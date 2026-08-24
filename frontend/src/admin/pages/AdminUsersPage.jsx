import { useEffect, useState } from "react";

import { useAuth } from "../../context/AuthContext.jsx";
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
  getAdminUsageStatus,
  titleCase,
} from "../utils/adminFormat.js";
import useAdminAccessRecovery from "../hooks/useAdminAccessRecovery.js";

const PAGE_LIMIT = 20;

function AdminUsersPage() {
  const {
    user: signedInUser,
    setUser: setSignedInUser,
  } = useAuth();
  const recoverAdminAccess = useAdminAccessRecovery();
  const [draftSearch, setDraftSearch] = useState("");
  const [query, setQuery] = useState({
    search: "",
    role: "",
    plan: "",
    page: 1,
  });
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState(
    getAdminPagination(null, PAGE_LIMIT)
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [selectedUserId, setSelectedUserId] = useState("");
  const [userDetails, setUserDetails] = useState(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const [detailsReloadKey, setDetailsReloadKey] = useState(0);
  const [editValues, setEditValues] = useState({
    role: "user",
    plan: "free",
  });
  const [pendingChanges, setPendingChanges] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [updateError, setUpdateError] = useState("");
  const [updateMessage, setUpdateMessage] = useState("");

  useEffect(() => {
    const abortController = new AbortController();

    const loadUsers = async () => {
      try {
        setError("");
        setIsLoading(true);
        const data = await adminApi.listUsers(
          {
            page: query.page,
            limit: PAGE_LIMIT,
            search: query.search,
            role: query.role,
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

        setUsers(Array.isArray(data.items) ? data.items : []);
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

    loadUsers();

    return () => abortController.abort();
  }, [query, recoverAdminAccess, reloadKey]);

  useEffect(() => {
    if (!selectedUserId) {
      return undefined;
    }

    const abortController = new AbortController();

    const loadUserDetails = async () => {
      try {
        setDetailsError("");
        setIsLoadingDetails(true);
        setUserDetails(null);
        setPendingChanges(null);
        setUpdateError("");
        setUpdateMessage("");

        const data = await adminApi.getUser(selectedUserId, {
          signal: abortController.signal,
        });

        if (abortController.signal.aborted) {
          return;
        }

        setUserDetails(data);
        setEditValues({
          role: data.user?.role || "user",
          plan: data.user?.plan || "free",
        });
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

    loadUserDetails();

    return () => abortController.abort();
  }, [detailsReloadKey, recoverAdminAccess, selectedUserId]);

  const closeDetails = () => {
    if (isSaving) {
      return;
    }

    setSelectedUserId("");
    setUserDetails(null);
    setPendingChanges(null);
  };

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
    setQuery({ search: "", role: "", plan: "", page: 1 });
  };

  const prepareUpdate = (event) => {
    event.preventDefault();

    if (!userDetails?.user) {
      return;
    }

    const changes = {};

    if (editValues.role !== userDetails.user.role) {
      changes.role = editValues.role;
    }

    if (editValues.plan !== userDetails.user.plan) {
      changes.plan = editValues.plan;
    }

    setUpdateError("");
    setUpdateMessage("");

    if (Object.keys(changes).length === 0) {
      setPendingChanges(null);
      setUpdateMessage("No account changes are pending.");
      return;
    }

    setPendingChanges(changes);
  };

  const confirmUpdate = async () => {
    if (!pendingChanges || !userDetails?.user || isSaving) {
      return;
    }

    try {
      setIsSaving(true);
      setUpdateError("");
      setUpdateMessage("");

      const response = await adminApi.updateUser(
        getAdminEntityId(userDetails.user),
        pendingChanges
      );
      const updatedUser = response.user;

      setUserDetails((currentDetails) => ({
        ...currentDetails,
        user: {
          ...currentDetails.user,
          ...updatedUser,
        },
      }));
      setUsers((currentUsers) =>
        currentUsers.map((user) =>
          getAdminEntityId(user) === getAdminEntityId(updatedUser)
            ? updatedUser
            : user
        )
      );
      setEditValues({
        role: updatedUser.role,
        plan: updatedUser.plan,
      });
      setPendingChanges(null);
      setUpdateMessage(
        response.message || "The user account was updated."
      );
      setReloadKey((key) => key + 1);

      if (
        getAdminEntityId(updatedUser) ===
        getAdminEntityId(signedInUser)
      ) {
        setSignedInUser((currentUser) => ({
          ...currentUser,
          ...updatedUser,
        }));
      }
    } catch (requestError) {
      if (await recoverAdminAccess(requestError)) {
        return;
      }

      setUpdateError(requestError.message);
    } finally {
      setIsSaving(false);
    }
  };

  const selectedUser = userDetails?.user;
  const aiUsage = userDetails?.aiUsage;
  const aiEntitlement =
    selectedUser?.aiEntitlement ||
    selectedUser?.entitlements?.aiSummary;

  return (
    <div>
      <AdminPageHeader
        eyebrow="Account governance"
        title="Users"
        description="Find platform accounts, inspect bounded account context, and intentionally manage platform roles and plans."
      />

      <section
        className="surface-panel mt-6 p-4 sm:p-5"
        aria-labelledby="user-filters-heading"
      >
        <h2 id="user-filters-heading" className="sr-only">
          User filters
        </h2>
        <form
          onSubmit={handleSearch}
          className="grid gap-3 md:grid-cols-[minmax(13rem,1fr)_10rem_10rem_auto]"
        >
          <div>
            <label htmlFor="admin-user-search" className="form-label">
              Search users
            </label>
            <input
              id="admin-user-search"
              type="search"
              value={draftSearch}
              onChange={(event) => setDraftSearch(event.target.value)}
              placeholder="Name or email"
              className="form-input mt-2"
            />
          </div>

          <div>
            <label htmlFor="admin-user-role" className="form-label">
              Role
            </label>
            <select
              id="admin-user-role"
              value={query.role}
              onChange={(event) =>
                setQuery((currentQuery) => ({
                  ...currentQuery,
                  search: draftSearch.trim(),
                  role: event.target.value,
                  page: 1,
                }))
              }
              className="form-input mt-2"
            >
              <option value="">All roles</option>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div>
            <label htmlFor="admin-user-plan" className="form-label">
              Plan
            </label>
            <select
              id="admin-user-plan"
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
            {(query.search || query.role || query.plan) && (
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

      {isLoading && <AdminLoading label="Loading users..." />}

      {!isLoading && error && (
        <AdminError
          message={error}
          onRetry={() => setReloadKey((key) => key + 1)}
        />
      )}

      {!isLoading && !error && (
        <section
          className="surface-panel mt-6 overflow-hidden"
          aria-labelledby="admin-users-table-heading"
        >
          <div className="border-theme flex items-center justify-between gap-4 border-b px-5 py-4">
            <h2
              id="admin-users-table-heading"
              className="text-heading font-semibold"
            >
              Platform accounts
            </h2>
            <span className="meta-badge rounded-md px-2.5 py-1 text-xs font-semibold">
              {formatAdminNumber(pagination.total)} users
            </span>
          </div>

          {users.length === 0 ? (
            <div className="p-5">
              <AdminEmpty
                title="No users found"
                description="Try a broader search or clear the current role and plan filters."
              />
            </div>
          ) : (
            <div className="scroll-area overflow-x-auto">
              <table id="admin-users-table" className="admin-table min-w-[52rem]">
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Email</th>
                    <th scope="col">Role</th>
                    <th scope="col">Plan</th>
                    <th scope="col">Joined</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={getAdminEntityId(user)}>
                      <td className="text-heading font-semibold">
                        {user.name}
                      </td>
                      <td className="break-all">{user.email}</td>
                      <td>
                        <AdminBadge
                          tone={user.role === "admin" ? "accent" : "neutral"}
                        >
                          {titleCase(user.role)}
                        </AdminBadge>
                      </td>
                      <td>
                        <AdminBadge
                          tone={user.plan === "premium" ? "accent" : "neutral"}
                        >
                          {titleCase(user.plan)}
                        </AdminBadge>
                      </td>
                      <td>{formatAdminDate(user.createdAt, { dateOnly: true })}</td>
                      <td>
                        <button
                          type="button"
                          className="button button-secondary min-h-10 px-3"
                          onClick={() =>
                            setSelectedUserId(getAdminEntityId(user))
                          }
                          aria-label={`View ${user.name}`}
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

      {selectedUserId && (
        <AdminDialog
          title={selectedUser ? selectedUser.name : "User details"}
          description="Safe account details and intentional platform access controls."
          onClose={closeDetails}
          isBusy={isSaving}
          size="wide"
        >
          {isLoadingDetails && (
            <AdminInlineLoading label="Loading user details..." />
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

          {!isLoadingDetails && !detailsError && selectedUser && (
            <div className="space-y-6">
              <AdminDefinitionList
                items={[
                  { label: "Email", value: selectedUser.email },
                  { label: "Status", value: selectedUser.status || "Not set" },
                  { label: "Joined", value: formatAdminDate(selectedUser.createdAt) },
                  { label: "Updated", value: formatAdminDate(selectedUser.updatedAt) },
                  {
                    label: "Workspaces",
                    value: formatAdminNumber(userDetails.workspaceCount),
                  },
                  {
                    label: "AI entitlement",
                    value: aiEntitlement
                      ? aiEntitlement.enabled
                        ? `${formatAdminNumber(
                            aiEntitlement.requestsPerWindow
                          )} requests / ${formatAdminNumber(
                            aiEntitlement.windowMinutes
                          )} minutes`
                        : "Not enabled"
                      : "No entitlement details available",
                  },
                ]}
              />

              <section aria-labelledby="user-workspaces-heading">
                <h3
                  id="user-workspaces-heading"
                  className="text-heading font-semibold"
                >
                  Recent workspaces
                </h3>
                {userDetails.workspaces?.length ? (
                  <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                    {userDetails.workspaces.map((workspace) => (
                      <li
                        key={getAdminEntityId(workspace)}
                        className="surface-subtle p-3"
                      >
                        <p className="text-heading break-words text-sm font-semibold">
                          {workspace.name}
                        </p>
                        <p className="text-muted mt-1 text-xs">
                          Created {formatAdminDate(workspace.createdAt)}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted mt-2 text-sm">
                    This account has no bounded workspace results.
                  </p>
                )}
              </section>

              <section aria-labelledby="user-ai-usage-heading">
                <h3
                  id="user-ai-usage-heading"
                  className="text-heading font-semibold"
                >
                  Active AI usage window
                </h3>
                {aiUsage ? (
                  <div className="mt-3">
                    <AdminDefinitionList
                      items={[
                        {
                          label: "Usage",
                          value: `${formatAdminNumber(
                            aiUsage.requestCount
                          )} of ${formatAdminNumber(aiUsage.limit)}`,
                        },
                        {
                          label: "Status",
                          value: titleCase(
                            getAdminUsageStatus(aiUsage)
                          ),
                        },
                        {
                          label: "Reset",
                          value: formatAdminDate(aiUsage.resetAt),
                        },
                        {
                          label: "Quota scope",
                          value: "Shared user AI quota",
                        },
                      ]}
                    />
                  </div>
                ) : (
                  <p className="text-muted mt-2 text-sm">
                    No active AI usage window exists for this account.
                  </p>
                )}
              </section>

              <section
                className="border-theme border-t pt-6"
                aria-labelledby="manage-user-heading"
              >
                <h3
                  id="manage-user-heading"
                  className="text-heading font-semibold"
                >
                  Role and plan
                </h3>
                <p className="text-muted mt-2 text-sm leading-6">
                  Changes affect platform access and AI entitlements. Passwords,
                  email, and usage counters cannot be changed here.
                </p>

                <form
                  onSubmit={prepareUpdate}
                  className="mt-4 grid gap-4 sm:grid-cols-2"
                  aria-busy={isSaving}
                >
                  <div>
                    <label htmlFor="edit-user-role" className="form-label">
                      Platform role
                    </label>
                    <select
                      id="edit-user-role"
                      value={editValues.role}
                      onChange={(event) => {
                        setPendingChanges(null);
                        setUpdateError("");
                        setUpdateMessage("");
                        setEditValues((currentValues) => ({
                          ...currentValues,
                          role: event.target.value,
                        }));
                      }}
                      disabled={isSaving}
                      className="form-input mt-2"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="edit-user-plan" className="form-label">
                      Plan
                    </label>
                    <select
                      id="edit-user-plan"
                      value={editValues.plan}
                      onChange={(event) => {
                        setPendingChanges(null);
                        setUpdateError("");
                        setUpdateMessage("");
                        setEditValues((currentValues) => ({
                          ...currentValues,
                          plan: event.target.value,
                        }));
                      }}
                      disabled={isSaving}
                      className="form-input mt-2"
                    >
                      <option value="free">Free</option>
                      <option value="premium">Premium</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="button button-primary"
                    >
                      Review changes
                    </button>
                  </div>
                </form>

                {pendingChanges && (
                  <div
                    className="surface-subtle mt-4 p-4"
                    role="group"
                    aria-label="Confirm user account changes"
                  >
                    <p className="text-heading text-sm font-semibold">
                      Confirm this account update
                    </p>
                    <p className="text-muted mt-2 text-sm leading-6">
                      {pendingChanges.role && (
                        <span className="block">
                          Role: {titleCase(selectedUser.role)} → {titleCase(pendingChanges.role)}
                        </span>
                      )}
                      {pendingChanges.plan && (
                        <span className="block">
                          Plan: {titleCase(selectedUser.plan)} → {titleCase(pendingChanges.plan)}
                        </span>
                      )}
                    </p>
                    {pendingChanges.role === "user" &&
                      selectedUser.role === "admin" && (
                        <p className="feedback feedback-error mt-3" role="alert">
                          This removes platform admin access. NovaHub will reject
                          the change if it would remove the final admin.
                        </p>
                      )}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={confirmUpdate}
                        disabled={isSaving}
                        className="button button-primary"
                        aria-busy={isSaving}
                      >
                        {isSaving && (
                          <span className="spinner" aria-hidden="true" />
                        )}
                        {isSaving ? "Updating..." : "Confirm update"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingChanges(null)}
                        disabled={isSaving}
                        className="button button-secondary"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {updateError && (
                  <p className="feedback feedback-error mt-4" role="alert">
                    {updateError}
                  </p>
                )}
                {updateMessage && (
                  <p className="feedback feedback-success mt-4" role="status">
                    {updateMessage}
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

export default AdminUsersPage;
