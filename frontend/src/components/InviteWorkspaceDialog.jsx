import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import api from "../api/axios.js";
import {
  CheckIcon,
  CloseIcon,
  CopyIcon,
  InviteIcon,
} from "./Icons.jsx";
import {
  getInvitationPath,
  isValidInvitationToken,
} from "../utils/invitationPath.js";

const INVITATION_STATUS_LABELS = {
  active: "Active",
  used: "Used",
  expired: "Expired",
  revoked: "Revoked",
};

function formatDateTime(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getActorLabel(actor) {
  return (
    actor?.name ||
    actor?.email ||
    "A workspace member"
  );
}

function InviteWorkspaceDialog({
  workspaceId,
  workspaceName,
  onClose,
}) {
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const invitationUrlRef = useRef(null);
  const isBusyRef = useRef(false);
  const invitationsRequestIdRef = useRef(0);
  const [invitationUrl, setInvitationUrl] = useState("");
  const [createdInvitationId, setCreatedInvitationId] =
    useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState("idle");
  const [invitations, setInvitations] = useState([]);
  const [isLoadingInvitations, setIsLoadingInvitations] =
    useState(true);
  const [listError, setListError] = useState("");
  const [managementError, setManagementError] =
    useState("");
  const [managementMessage, setManagementMessage] =
    useState("");
  const [revokingInvitationId, setRevokingInvitationId] =
    useState("");
  const [confirmationInvitationId, setConfirmationInvitationId] =
    useState("");

  const isBusy =
    isGenerating || Boolean(revokingInvitationId);

  useEffect(() => {
    isBusyRef.current = isBusy;
  }, [isBusy]);

  useEffect(() => {
    const previouslyFocusedElement = document.activeElement;
    const previousBodyOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();

        if (!isBusyRef.current) {
          onClose();
        }

        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusableElements = Array.from(
        dialogRef.current.querySelectorAll(
          'button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])'
        )
      );

      if (focusableElements.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement =
        focusableElements[focusableElements.length - 1];

      if (
        !dialogRef.current.contains(
          document.activeElement
        )
      ) {
        event.preventDefault();
        firstElement.focus();
        return;
      }

      if (
        event.shiftKey &&
        document.activeElement === firstElement
      ) {
        event.preventDefault();
        lastElement.focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === lastElement
      ) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;

      if (
        previouslyFocusedElement instanceof HTMLElement &&
        document.contains(previouslyFocusedElement)
      ) {
        previouslyFocusedElement.focus();
      }
    };
  }, [onClose]);

  useEffect(() => {
    if (invitationUrl) {
      invitationUrlRef.current?.focus();
      invitationUrlRef.current?.select();
    }
  }, [invitationUrl]);

  const loadInvitations = useCallback(
    async ({ signal, showLoading = true } = {}) => {
      const requestId =
        invitationsRequestIdRef.current + 1;
      invitationsRequestIdRef.current = requestId;

      try {
        setListError("");

        if (showLoading) {
          setIsLoadingInvitations(true);
        }

        const response = await api.get(
          `/workspaces/${workspaceId}/invitations`,
          { signal }
        );
        const invitationList = response.data?.invitations;

        if (!Array.isArray(invitationList)) {
          throw new Error(
            "The server returned an invalid invitation list."
          );
        }

        if (
          requestId === invitationsRequestIdRef.current
        ) {
          setInvitations(invitationList);
        }

        return true;
      } catch (requestError) {
        if (signal?.aborted) {
          return false;
        }

        if (
          requestId === invitationsRequestIdRef.current
        ) {
          setListError(
            requestError.response?.data?.message ||
              requestError.message ||
              "Failed to load invitations. Please try again."
          );
        }

        return false;
      } finally {
        if (
          !signal?.aborted &&
          showLoading &&
          requestId === invitationsRequestIdRef.current
        ) {
          setIsLoadingInvitations(false);
        }
      }
    },
    [workspaceId]
  );

  useEffect(() => {
    const abortController = new AbortController();
    const loadTimer = window.setTimeout(() => {
      loadInvitations({
        signal: abortController.signal,
      });
    }, 0);

    return () => {
      window.clearTimeout(loadTimer);
      abortController.abort();
    };
  }, [loadInvitations]);

  const handleGenerateInvitation = async () => {
    if (isBusyRef.current) {
      return;
    }

    try {
      isBusyRef.current = true;
      setError("");
      setCopyStatus("idle");
      setManagementError("");
      setManagementMessage("");
      setConfirmationInvitationId("");
      setIsGenerating(true);

      const response = await api.post(
        `/workspaces/${workspaceId}/invitations`
      );
      const invitation = response.data?.invitation;

      if (!isValidInvitationToken(invitation?.token)) {
        throw new Error("The server returned an invalid invitation link.");
      }

      const invitationPath = getInvitationPath(invitation.token);

      setInvitationUrl(
        `${window.location.origin}${invitationPath}`
      );
      setCreatedInvitationId(
        typeof invitation.id === "string"
          ? invitation.id
          : ""
      );
      setExpiresAt(invitation.expiresAt || "");

      await loadInvitations({ showLoading: false });
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Failed to create an invitation. Please try again."
      );
    } finally {
      isBusyRef.current = false;
      setIsGenerating(false);
    }
  };

  const handleCopyInvitation = async () => {
    try {
      setCopyStatus("idle");
      let copiedWithClipboardApi = false;

      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(invitationUrl);
          copiedWithClipboardApi = true;
        } catch {
          copiedWithClipboardApi = false;
        }
      }

      if (!copiedWithClipboardApi) {
        invitationUrlRef.current?.focus();
        invitationUrlRef.current?.select();

        if (!document.execCommand("copy")) {
          throw new Error("Copy command was unavailable.");
        }
      }

      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    }
  };

  const handleRevokeInvitation = async (
    invitationId
  ) => {
    if (isBusyRef.current) {
      return;
    }

    try {
      isBusyRef.current = true;
      setManagementError("");
      setManagementMessage("");
      setRevokingInvitationId(invitationId);

      const response = await api.patch(
        `/workspaces/${workspaceId}/invitations/${invitationId}/revoke`
      );
      const revokedInvitation = response.data?.invitation;

      if (
        !revokedInvitation?.id ||
        revokedInvitation.status !== "revoked"
      ) {
        throw new Error(
          "The server returned an invalid revoked invitation."
        );
      }

      setInvitations((currentInvitations) =>
        currentInvitations.map((invitation) =>
          invitation.id === revokedInvitation.id
            ? revokedInvitation
            : invitation
        )
      );
      setManagementMessage(
        "Invitation revoked. Its link can no longer be used."
      );

      if (createdInvitationId === revokedInvitation.id) {
        setInvitationUrl("");
        setCreatedInvitationId("");
        setExpiresAt("");
        setCopyStatus("idle");
      }
    } catch (requestError) {
      setManagementError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Failed to revoke the invitation. Please try again."
      );

      if (requestError.response?.status === 409) {
        await loadInvitations({ showLoading: false });
      }
    } finally {
      isBusyRef.current = false;
      setRevokingInvitationId("");
      setConfirmationInvitationId("");
    }
  };

  const formattedExpiry = formatDateTime(expiresAt);

  return (
    <div
      className="invite-dialog-backdrop fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 py-8 sm:px-6"
      onMouseDown={(event) => {
        if (
          !isBusy &&
          event.target === event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-dialog-title"
        aria-describedby="invite-dialog-description"
        aria-busy={isBusy}
        tabIndex={-1}
        className="scroll-area surface-panel page-enter my-auto max-h-[calc(100dvh-4rem)] w-full max-w-2xl overflow-y-auto p-5 sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <span
              className="accent-tile flex size-10 items-center justify-center rounded-[10px]"
              aria-hidden="true"
            >
              <InviteIcon className="size-5" />
            </span>

            <p className="eyebrow mt-4">Secure invitation</p>
            <h2
              id="invite-dialog-title"
              className="text-heading mt-2 break-words text-xl font-semibold tracking-[-0.02em]"
            >
              Manage invitations to {workspaceName}
            </h2>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="button button-secondary min-h-10 shrink-0 px-3"
            aria-label="Close invitation dialog"
          >
            <CloseIcon className="size-4" />
          </button>
        </div>

        <p
          id="invite-dialog-description"
          className="text-muted mt-3 text-sm leading-6"
        >
          Create single-use links and review their lifecycle. Raw links are
          shown only immediately after creation and cannot be recovered later.
        </p>

        <section
          className="surface-subtle mt-5 p-4 sm:p-5"
          aria-labelledby="create-invitation-heading"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3
                id="create-invitation-heading"
                className="text-heading font-semibold"
              >
                Create an invitation
              </h3>
              <p className="text-muted mt-1 text-sm leading-6">
                Each link expires and can be accepted once.
              </p>
            </div>

            {!invitationUrl && (
              <button
                type="button"
                onClick={handleGenerateInvitation}
                disabled={isBusy}
                className="button button-primary shrink-0"
              >
                {isGenerating ? (
                  <span className="spinner" aria-hidden="true" />
                ) : (
                  <InviteIcon className="size-4" />
                )}
                {isGenerating
                  ? "Generating..."
                  : "Generate link"}
              </button>
            )}
          </div>

          {error && (
            <div className="feedback feedback-error mt-4" role="alert">
              {error}
            </div>
          )}

          {invitationUrl && (
            <div className="mt-4">
              <div className="feedback feedback-success" role="status">
                <span className="flex items-start gap-2">
                  <CheckIcon className="mt-0.5 size-4 shrink-0" />
                  <span>
                    Invitation created. Copy this link now; NovaHub cannot
                    recover it later.
                  </span>
                </span>
              </div>

              <label htmlFor="invitation-url" className="form-label mt-4">
                Newly created invitation link
              </label>
              <div className="mt-2 flex min-w-0 flex-col gap-2 sm:flex-row">
                <input
                  ref={invitationUrlRef}
                  id="invitation-url"
                  type="text"
                  readOnly
                  value={invitationUrl}
                  onFocus={(event) => event.currentTarget.select()}
                  className="form-input min-w-0 flex-1"
                />
                <button
                  type="button"
                  onClick={handleCopyInvitation}
                  disabled={isBusy}
                  className="button button-secondary shrink-0"
                >
                  {copyStatus === "copied" ? (
                    <CheckIcon className="size-4" />
                  ) : (
                    <CopyIcon className="size-4" />
                  )}
                  {copyStatus === "copied" ? "Copied" : "Copy link"}
                </button>
              </div>

              {formattedExpiry && (
                <p className="text-muted mt-3 text-xs leading-5">
                  Expires {formattedExpiry}
                </p>
              )}

              {copyStatus === "copied" && (
                <p
                  className="text-accent mt-3 text-sm font-medium"
                  role="status"
                  aria-live="polite"
                >
                  Invitation link copied to your clipboard.
                </p>
              )}

              {copyStatus === "error" && (
                <p className="feedback feedback-error mt-3" role="alert">
                  Copy was blocked by your browser. Select the link and copy
                  it manually.
                </p>
              )}

              <div className="border-theme mt-4 border-t pt-4">
                <button
                  type="button"
                  onClick={handleGenerateInvitation}
                  disabled={isBusy}
                  className="button button-secondary"
                >
                  {isGenerating ? (
                    <span className="spinner" aria-hidden="true" />
                  ) : (
                    <InviteIcon className="size-4" />
                  )}
                  {isGenerating
                    ? "Generating..."
                    : "Create another link"}
                </button>
                <p className="text-muted mt-2 text-xs leading-5">
                  Creating another link replaces only the link displayed
                  above. Earlier invitations remain listed below.
                </p>
              </div>
            </div>
          )}
        </section>

        <section
          className="border-theme mt-6 border-t pt-5"
          aria-labelledby="recent-invitations-heading"
          aria-busy={isLoadingInvitations}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3
                id="recent-invitations-heading"
                className="text-heading font-semibold"
              >
                Active and recent invitations
              </h3>
              <p className="text-muted mt-1 text-sm leading-6">
                Previous raw links are intentionally unavailable.
              </p>
            </div>

            {!isLoadingInvitations && !listError && (
              <span className="meta-badge rounded-md px-2.5 py-1 text-xs font-semibold">
                {invitations.length} shown
              </span>
            )}
          </div>

          {managementMessage && (
            <div
              className="feedback feedback-success mt-4"
              role="status"
              aria-live="polite"
            >
              {managementMessage}
            </div>
          )}

          {managementError && (
            <div className="feedback feedback-error mt-4" role="alert">
              {managementError}
            </div>
          )}

          {isLoadingInvitations && (
            <div
              className="mt-4 grid gap-3"
              role="status"
              aria-live="polite"
            >
              <span className="sr-only">Loading invitations...</span>
              {[0, 1].map((item) => (
                <div key={item} className="surface-subtle p-4" aria-hidden="true">
                  <div className="skeleton h-4 w-1/3" />
                  <div className="skeleton mt-3 h-3 w-2/3" />
                  <div className="skeleton mt-2 h-3 w-1/2" />
                </div>
              ))}
            </div>
          )}

          {!isLoadingInvitations && listError && (
            <div className="feedback feedback-error mt-4" role="alert">
              <p>{listError}</p>
              <button
                type="button"
                onClick={() => loadInvitations()}
                disabled={isBusy}
                className="button button-secondary mt-3"
              >
                Try again
              </button>
            </div>
          )}

          {!isLoadingInvitations &&
            !listError &&
            invitations.length === 0 && (
              <div className="surface-subtle mt-4 px-4 py-6 text-center">
                <p className="text-heading text-sm font-semibold">
                  No invitations yet
                </p>
                <p className="text-muted mt-1 text-xs leading-5">
                  Generate the first secure invitation for this workspace.
                </p>
              </div>
            )}

          {!isLoadingInvitations &&
            !listError &&
            invitations.length > 0 && (
              <ul className="mt-4 grid gap-3">
                {invitations.map((invitation) => {
                  const createdAt = formatDateTime(
                    invitation.createdAt
                  );
                  const invitationExpiry = formatDateTime(
                    invitation.expiresAt
                  );
                  const statusLabel =
                    INVITATION_STATUS_LABELS[invitation.status] ||
                    "Unknown";
                  const lifecycleAt = formatDateTime(
                    invitation.usedAt || invitation.revokedAt
                  );
                  const lifecycleActor = invitation.usedBy ||
                    invitation.revokedBy;
                  const isRevoking =
                    revokingInvitationId === invitation.id;

                  return (
                    <li
                      key={invitation.id}
                      className="surface-subtle p-4"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`invitation-status invitation-status-${invitation.status} rounded-md px-2.5 py-1 text-xs font-semibold`}
                            >
                              {statusLabel}
                            </span>
                            <span className="text-muted text-xs">
                              Created by {getActorLabel(invitation.createdBy)}
                            </span>
                          </div>

                          <dl className="text-muted mt-3 grid gap-2 text-xs sm:grid-cols-2">
                            <div>
                              <dt className="font-semibold">Created</dt>
                              <dd className="mt-0.5">
                                {createdAt || "Unknown"}
                              </dd>
                            </div>
                            <div>
                              <dt className="font-semibold">Expiry</dt>
                              <dd className="mt-0.5">
                                {invitationExpiry || "Unknown"}
                              </dd>
                            </div>
                          </dl>

                          {invitation.status === "used" && (
                            <p className="text-muted mt-3 text-xs leading-5">
                              Used {lifecycleAt || "at an unknown time"} by{" "}
                              {getActorLabel(lifecycleActor)}.
                            </p>
                          )}

                          {invitation.status === "revoked" && (
                            <p className="text-muted mt-3 text-xs leading-5">
                              Revoked {lifecycleAt || "at an unknown time"} by{" "}
                              {getActorLabel(lifecycleActor)}.
                            </p>
                          )}
                        </div>

                        {invitation.status === "active" &&
                          (confirmationInvitationId === invitation.id ? (
                            <div
                              className="flex shrink-0 flex-col gap-2"
                              role="group"
                              aria-label="Confirm invitation revocation"
                            >
                              <p className="text-muted text-xs font-medium">
                                Disable this link?
                              </p>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleRevokeInvitation(invitation.id)
                                  }
                                  disabled={isBusy}
                                  className="button button-danger"
                                >
                                  {isRevoking && (
                                    <span
                                      className="spinner"
                                      aria-hidden="true"
                                    />
                                  )}
                                  {isRevoking
                                    ? "Revoking..."
                                    : "Confirm revoke"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirmationInvitationId("")
                                  }
                                  disabled={isBusy}
                                  className="button button-secondary"
                                >
                                  Keep active
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setManagementError("");
                                setManagementMessage("");
                                setConfirmationInvitationId(invitation.id);
                              }}
                              disabled={isBusy}
                              className="button button-danger shrink-0"
                              aria-label={`Revoke invitation created by ${getActorLabel(invitation.createdBy)}`}
                            >
                              <CloseIcon className="size-4" />
                              Revoke
                            </button>
                          ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
        </section>
      </section>
    </div>
  );
}

export default InviteWorkspaceDialog;
