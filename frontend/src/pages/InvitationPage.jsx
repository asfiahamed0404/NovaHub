import { useEffect, useState } from "react";
import {
  Link,
  Navigate,
  useNavigate,
  useParams,
} from "react-router";

import api from "../api/axios.js";
import {
  ArrowRightIcon,
  CheckIcon,
  InviteIcon,
} from "../components/Icons.jsx";
import NovaHubLogo from "../components/NovaHubLogo.jsx";
import ThemeSelector from "../components/ThemeSelector.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { getInvitationPath } from "../utils/invitationPath.js";

const INVITATION_ERROR_CONTENT = {
  INVALID_INVITATION_TOKEN: {
    eyebrow: "Invalid invitation",
    title: "This invitation link is malformed",
    description:
      "Check that you opened the complete link. If it still does not work, ask a workspace member for a new invitation.",
  },
  INVITATION_NOT_FOUND: {
    eyebrow: "Invitation not found",
    title: "We could not find this invitation",
    description:
      "The link may be incorrect or no longer available. Ask a workspace member to create a new invitation.",
  },
  INVITATION_EXPIRED: {
    eyebrow: "Invitation expired",
    title: "This invitation has expired",
    description:
      "Invitation links are time-limited for security. Ask a workspace member to generate a new one.",
  },
  INVITATION_ALREADY_USED: {
    eyebrow: "Invitation already used",
    title: "This invitation is no longer available",
    description:
      "NovaHub invitation links can be accepted once. Ask a workspace member for a new link if you still need access.",
  },
  INVITATION_REVOKED: {
    eyebrow: "Invitation revoked",
    title: "This invitation has been revoked",
    description:
      "A workspace member disabled this invitation. Ask them to create a new link if you still need access.",
  },
  INVITATION_WORKSPACE_NOT_FOUND: {
    eyebrow: "Workspace unavailable",
    title: "This workspace no longer exists",
    description:
      "The invitation cannot be accepted because its workspace is no longer available.",
  },
  UNKNOWN_INVITATION_ERROR: {
    eyebrow: "Invitation unavailable",
    title: "We could not load this invitation",
    description:
      "Please try again. If the problem continues, ask a workspace member for a new invitation.",
  },
};

function formatExpiry(expiresAt) {
  const expiryDate = new Date(expiresAt);

  if (Number.isNaN(expiryDate.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "long",
    timeStyle: "short",
  }).format(expiryDate);
}

function InvitationHeader() {
  return (
    <header className="app-header">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <NovaHubLogo />
        <ThemeSelector compact />
      </div>
    </header>
  );
}

function InvitationError({ code, user }) {
  const content =
    INVITATION_ERROR_CONTENT[code] ||
    INVITATION_ERROR_CONTENT.UNKNOWN_INVITATION_ERROR;

  return (
    <section
      className="surface-panel page-enter mx-auto w-full max-w-xl p-6 text-center sm:p-8"
      aria-labelledby="invitation-error-heading"
    >
      <span
        className="accent-tile mx-auto flex size-11 items-center justify-center rounded-[10px]"
        aria-hidden="true"
      >
        <InviteIcon className="size-5" />
      </span>
      <p className="eyebrow mt-5">{content.eyebrow}</p>
      <h1
        id="invitation-error-heading"
        className="text-heading mt-2 text-2xl font-semibold tracking-[-0.025em]"
      >
        {content.title}
      </h1>
      <p className="text-muted mx-auto mt-3 max-w-md text-sm leading-6">
        {content.description}
      </p>
      <Link
        to={user ? "/dashboard" : "/login"}
        className="button button-secondary mt-6"
      >
        {user ? "Return to dashboard" : "Go to login"}
      </Link>
    </section>
  );
}

function InvitationPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const invitationPath = getInvitationPath(token);
  const [view, setView] = useState({
    status: "loading",
    invitation: null,
    workspace: null,
    errorCode: "",
  });
  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState("");

  useEffect(() => {
    if (!invitationPath) {
      return undefined;
    }

    const abortController = new AbortController();

    const fetchInvitation = async () => {
      try {
        setView({
          status: "loading",
          invitation: null,
          workspace: null,
          errorCode: "",
        });

        const response = await api.get(
          `/invitations/${token}`,
          { signal: abortController.signal }
        );
        const invitation = response.data?.invitation;

        if (
          !invitation ||
          typeof invitation.workspace?.name !== "string"
        ) {
          throw new Error("Invalid invitation preview response.");
        }

        const isMember =
          response.data?.isMember === true ||
          invitation.isMember === true;

        setView({
          status: isMember ? "already_member" : "valid",
          invitation,
          workspace: isMember ? invitation.workspace : null,
          errorCode: "",
        });
      } catch (requestError) {
        if (abortController.signal.aborted) {
          return;
        }

        setView({
          status: "error",
          invitation: null,
          workspace: null,
          errorCode:
            requestError.response?.data?.code ||
            "UNKNOWN_INVITATION_ERROR",
        });
      }
    };

    fetchInvitation();

    return () => abortController.abort();
  }, [invitationPath, token]);

  const handleAcceptInvitation = async () => {
    try {
      setAcceptError("");
      setIsAccepting(true);

      const response = await api.post(
        `/invitations/${token}/accept`
      );
      const workspace = response.data?.workspace;

      if (!workspace?._id) {
        throw new Error("The server returned an invalid workspace.");
      }

      navigate(`/workspaces/${workspace._id}`, {
        replace: true,
      });
    } catch (requestError) {
      const responseData = requestError.response?.data;
      const errorCode = responseData?.code;

      if (
        errorCode === "ALREADY_WORKSPACE_MEMBER" ||
        requestError.response?.status === 409
      ) {
        setView((currentView) => ({
          ...currentView,
          status: "already_member",
          workspace: responseData?.workspace ||
            currentView.invitation?.workspace || {
              name: "this workspace",
            },
        }));
        return;
      }

      if (requestError.response?.status === 401) {
        logout();
        navigate("/login", {
          replace: true,
          state: { from: invitationPath },
        });
        return;
      }

      if (INVITATION_ERROR_CONTENT[errorCode]) {
        setView({
          status: "error",
          invitation: null,
          workspace: null,
          errorCode,
        });
        return;
      }

      setAcceptError(
        responseData?.message ||
          requestError.message ||
          "Failed to accept the invitation. Please try again."
      );
    } finally {
      setIsAccepting(false);
    }
  };

  const viewStatus = invitationPath
    ? view.status
    : "error";
  const invitationErrorCode = invitationPath
    ? view.errorCode
    : "INVALID_INVITATION_TOKEN";

  if (
    viewStatus === "valid" &&
    !user &&
    invitationPath
  ) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: invitationPath }}
      />
    );
  }

  const formattedExpiry = view.invitation?.expiresAt
    ? formatExpiry(view.invitation.expiresAt)
    : "";
  const workspaceName =
    view.workspace?.name ||
    view.invitation?.workspace?.name ||
    "this workspace";
  const workspaceId =
    view.workspace?._id ||
    view.invitation?.workspace?._id;

  return (
    <div className="app-shell">
      <InvitationHeader />

      <main className="mx-auto flex w-full max-w-4xl items-center px-4 py-10 sm:px-6 sm:py-16">
        {viewStatus === "loading" && (
          <section
            className="surface-panel mx-auto flex min-h-56 w-full max-w-xl flex-col items-center justify-center p-6 text-center sm:p-8"
            aria-busy="true"
            role="status"
            aria-live="polite"
          >
            <span className="spinner text-accent" aria-hidden="true" />
            <p className="text-heading mt-4 font-semibold">
              Checking invitation...
            </p>
            <p className="text-muted mt-2 text-sm">
              NovaHub is securely validating this link.
            </p>
          </section>
        )}

        {viewStatus === "error" && (
          <InvitationError code={invitationErrorCode} user={user} />
        )}

        {viewStatus === "valid" && user && (
          <section
            className="surface-panel page-enter mx-auto w-full max-w-xl p-6 sm:p-8"
            aria-labelledby="invitation-heading"
          >
            <span
              className="accent-tile flex size-11 items-center justify-center rounded-[10px]"
              aria-hidden="true"
            >
              <InviteIcon className="size-5" />
            </span>
            <p className="eyebrow mt-5">Workspace invitation</p>
            <h1
              id="invitation-heading"
              className="text-heading mt-2 break-words text-2xl font-semibold tracking-[-0.025em] sm:text-3xl"
            >
              Join {workspaceName}
            </h1>
            <p className="text-muted mt-3 text-sm leading-6">
              You are signed in as{" "}
              <span className="text-body font-semibold">
                {user.email}
              </span>
              . Review the workspace name, then explicitly accept to become a
              member.
            </p>

            {formattedExpiry && (
              <dl className="surface-subtle mt-5 p-4 text-sm">
                <div>
                  <dt className="text-muted text-xs font-medium uppercase tracking-wide">
                    Invitation expires
                  </dt>
                  <dd className="text-body mt-1 font-medium">
                    <time dateTime={view.invitation.expiresAt}>
                      {formattedExpiry}
                    </time>
                  </dd>
                </div>
              </dl>
            )}

            {acceptError && (
              <div
                className="feedback feedback-error mt-5"
                role="alert"
              >
                {acceptError}
              </div>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleAcceptInvitation}
                disabled={isAccepting}
                className="button button-primary flex-1"
                aria-busy={isAccepting}
              >
                {isAccepting ? (
                  <span className="spinner" aria-hidden="true" />
                ) : (
                  <CheckIcon className="size-4" />
                )}
                {isAccepting
                  ? "Accepting invitation..."
                  : "Accept invitation"}
              </button>
              <Link
                to="/dashboard"
                className="button button-secondary"
              >
                Not now
              </Link>
            </div>
          </section>
        )}

        {viewStatus === "already_member" && (
          <section
            className="surface-panel page-enter mx-auto w-full max-w-xl p-6 text-center sm:p-8"
            aria-labelledby="already-member-heading"
          >
            <span
              className="accent-tile mx-auto flex size-11 items-center justify-center rounded-[10px]"
              aria-hidden="true"
            >
              <CheckIcon className="size-5" />
            </span>
            <p className="eyebrow mt-5">Already a member</p>
            <h1
              id="already-member-heading"
              className="text-heading mt-2 break-words text-2xl font-semibold tracking-[-0.025em]"
            >
              You already belong to {workspaceName}
            </h1>
            <p className="text-muted mx-auto mt-3 max-w-md text-sm leading-6">
              No duplicate membership was created. You can continue directly
              to the workspace.
            </p>
            <Link
              to={
                workspaceId
                  ? `/workspaces/${workspaceId}`
                  : "/dashboard"
              }
              className="button button-primary mt-6"
            >
              {workspaceId ? "Open workspace" : "View your workspaces"}
              <ArrowRightIcon className="size-4" />
            </Link>
          </section>
        )}
      </main>
    </div>
  );
}

export default InvitationPage;
