import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { useAuth } from "../context/AuthContext.jsx";
import api from "../api/axios.js";
import { CheckIcon, CloseIcon, SparklesIcon } from "./Icons.jsx";

// ──────────────────────────────────────────────
// Scope configuration
// ──────────────────────────────────────────────

const SCOPES = [
  {
    id: "missed",
    label: "Catch Me Up",
    description:
      "Summarize messages since your last read checkpoint.",
  },
  {
    id: "recent",
    label: "Recent Summary",
    description:
      "Summarize the latest workspace activity.",
  },
  {
    id: "overview",
    label: "Workspace Overview",
    description:
      "Get context on the workspace and its current discussions.",
  },
];

// ──────────────────────────────────────────────
// Error message normalization
// ──────────────────────────────────────────────

const AI_PROVIDER_ERROR_MESSAGES = {
  AI_PROVIDER_UNCONFIGURED:
    "AI summaries are not available right now. Please try again later.",
  AI_PROVIDER_TIMEOUT:
    "The AI service took too long to respond. Please try again.",
  AI_PROVIDER_FAILURE:
    "The AI service encountered an error. Please try again.",
  AI_PROVIDER_MALFORMED_RESPONSE:
    "The AI service returned an unexpected response. Please try again.",
  AI_PROVIDER_INCOMPLETE_GENERATION:
    "The AI service returned an incomplete response. Please try again.",
};

function getErrorMessage(error) {
  const status = error.response?.status;
  const data = error.response?.data;

  if (status === 401) {
    return null; // signals caller to handle logout
  }

  if (status === 403) {
    return "You do not have access to this workspace.";
  }

  if (status === 429) {
    // Backend returns a user-friendly rate-limit message already
    return (
      data?.message ||
      "You have reached the AI summary limit. Please try again later."
    );
  }

  if (data?.code && AI_PROVIDER_ERROR_MESSAGES[data.code]) {
    return AI_PROVIDER_ERROR_MESSAGES[data.code];
  }

  return (
    data?.message || "An unexpected error occurred. Please try again."
  );
}

// ──────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────

function SectionList({ label, items, id }) {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby={id}>
      <p id={id} className="ai-summary-section-label">
        {label}
      </p>
      <ul className="ai-summary-list" aria-label={label}>
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function PlanBadge({ plan }) {
  const isPremium = plan === "premium";
  return (
    <span
      className={`plan-badge ${
        isPremium ? "plan-badge-premium" : "plan-badge-free"
      }`}
      aria-label={`${isPremium ? "Premium" : "Free"} plan`}
    >
      {isPremium ? "Premium" : "Free plan"}
    </span>
  );
}

// ──────────────────────────────────────────────
// Main dialog
// ──────────────────────────────────────────────

function AiSummaryDialog({
  workspaceId,
  onClose,
  missedCount,
  onReadStateRefresh,
  initialScope = "recent",
}) {
  const { user, logout } = useAuth();

  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const isBusyRef = useRef(false);

  const [activeScope, setActiveScope] = useState(initialScope);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  // Mark-as-read state (only for missed scope)
  const [isMarkingRead, setIsMarkingRead] = useState(false);
  const [markReadError, setMarkReadError] = useState("");
  const [markReadSuccess, setMarkReadSuccess] = useState(false);

  // Keep isBusyRef in sync for Escape key guard
  useEffect(() => {
    isBusyRef.current = isGenerating || isMarkingRead;
  }, [isGenerating, isMarkingRead]);

  // Clear result/error when scope changes
  const handleScopeChange = useCallback((scopeId) => {
    setActiveScope(scopeId);
    setResult(null);
    setError("");
    setMarkReadError("");
    setMarkReadSuccess(false);
  }, []);

  // Dialog keyboard / scroll-lock management
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;

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

      const focusable = Array.from(
        dialogRef.current.querySelectorAll(
          'button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])'
        )
      );

      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (!dialogRef.current.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
        return;
      }

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;

      if (
        previouslyFocused instanceof HTMLElement &&
        document.contains(previouslyFocused)
      ) {
        previouslyFocused.focus();
      }
    };
  }, [onClose]);

  // Generate summary
  const handleGenerate = useCallback(async () => {
    if (isGenerating) {
      return;
    }

    setIsGenerating(true);
    setError("");
    setResult(null);
    setMarkReadError("");
    setMarkReadSuccess(false);

    try {
      const response = await api.post(
        `/workspaces/${workspaceId}/ai/summary`,
        { scope: activeScope }
      );

      setResult(response.data);
    } catch (err) {
      const message = getErrorMessage(err);

      if (message === null) {
        // 401 — session invalid
        logout();
        return;
      }

      setError(message);
    } finally {
      setIsGenerating(false);
    }
  }, [isGenerating, workspaceId, activeScope, logout]);

  // Mark summarized messages as read
  const handleMarkAsRead = useCallback(async () => {
    if (!result?.coverage?.toMessageId || isMarkingRead) {
      return;
    }

    setIsMarkingRead(true);
    setMarkReadError("");

    try {
      await api.put(`/workspaces/${workspaceId}/read-state`, {
        messageId: result.coverage.toMessageId,
      });

      setMarkReadSuccess(true);

      // Refresh the read-state count in the parent trigger
      if (typeof onReadStateRefresh === "function") {
        onReadStateRefresh();
      }
    } catch (err) {
      const status = err.response?.status;
      if (status === 401) {
        logout();
        return;
      }

      setMarkReadError(
        err.response?.data?.message ||
          "Failed to mark messages as read. Please try again."
      );
    } finally {
      setIsMarkingRead(false);
    }
  }, [result, isMarkingRead, workspaceId, onReadStateRefresh, logout]);

  const currentScope = SCOPES.find((s) => s.id === activeScope);
  const showMarkAsRead =
    activeScope === "missed" &&
    result?.coverage?.toMessageId &&
    !markReadSuccess;

  return (
    <div
      className="invite-dialog-backdrop fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isBusyRef.current) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        id="ai-summary-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-summary-dialog-title"
        className="surface-panel flex w-full max-w-2xl flex-col overflow-hidden"
        style={{ maxHeight: "90dvh" }}
      >
        {/* Header */}
        <div className="border-theme flex shrink-0 items-center gap-3 border-b px-5 py-4 sm:px-6">
          <span
            className="accent-tile flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)]"
            aria-hidden="true"
          >
            <SparklesIcon className="size-4" />
          </span>

          <div className="min-w-0 flex-1">
            <h2
              id="ai-summary-dialog-title"
              className="text-heading font-semibold"
            >
              AI Workspace Summary
            </h2>
            <p className="text-muted text-xs">
              Powered by NovaHub AI
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <PlanBadge plan={user?.plan ?? "free"} />

            <button
              ref={closeButtonRef}
              id="ai-summary-dialog-close"
              type="button"
              onClick={onClose}
              disabled={isGenerating || isMarkingRead}
              className="button button-secondary px-3"
              aria-label="Close AI summary dialog"
            >
              <CloseIcon className="size-4" />
            </button>
          </div>
        </div>

        {/* Scope selector */}
        <div className="border-theme shrink-0 border-b px-5 py-4 sm:px-6">
          <div
            className="ai-scope-tabs"
            role="group"
            aria-label="Summary type"
          >
            {SCOPES.map((scope) => (
              <button
                key={scope.id}
                id={`ai-scope-tab-${scope.id}`}
                type="button"
                className="ai-scope-tab"
                aria-pressed={activeScope === scope.id}
                onClick={() => handleScopeChange(scope.id)}
                disabled={isGenerating || isMarkingRead}
              >
                {scope.label}
                {scope.id === "missed" &&
                  missedCount > 0 && (
                    <span
                      className="missed-badge"
                      aria-label={`${missedCount} unread`}
                    >
                      {missedCount > 99 ? "99+" : missedCount}
                    </span>
                  )}
              </button>
            ))}
          </div>

          <p className="text-muted mt-2 text-sm">
            {currentScope?.description}
          </p>
        </div>

        {/* Body — scrollable */}
        <div className="scroll-area min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {/* Error */}
          {error && (
            <p
              className="feedback feedback-error"
              role="alert"
              id="ai-summary-error"
            >
              {error}
            </p>
          )}

          {/* Result */}
          {result && !error && (
            <div className="flex flex-col gap-5">
              {/* Truncated notice */}
              {result.coverage?.truncated && (
                <div
                  className="ai-truncated-notice"
                  role="note"
                  id="ai-summary-truncated-notice"
                >
                  <SparklesIcon className="mt-px size-4 shrink-0" />
                  <span>
                    This summary covers{" "}
                    <strong>
                      {result.coverage.summarizedMessageCount}
                    </strong>{" "}
                    of{" "}
                    <strong>
                      {result.coverage.totalEligibleMessages}
                    </strong>{" "}
                    messages. Older messages were not included.
                  </span>
                </div>
              )}

              {/* Summary */}
              <section aria-labelledby="ai-result-summary-label">
                <p
                  id="ai-result-summary-label"
                  className="ai-summary-section-label"
                >
                  Summary
                </p>
                <p
                  className="ai-summary-text"
                  id="ai-result-summary-text"
                >
                  {result.summary}
                </p>
              </section>

              {/* Decisions */}
              <SectionList
                label="Decisions"
                items={result.decisions}
                id="ai-result-decisions-label"
              />

              {/* Action Items */}
              <SectionList
                label="Action Items"
                items={result.actionItems}
                id="ai-result-action-items-label"
              />

              {/* Open Questions */}
              <SectionList
                label="Open Questions"
                items={result.openQuestions}
                id="ai-result-open-questions-label"
              />

              {/* Coverage meta */}
              <p
                className="ai-coverage-meta"
                id="ai-result-coverage"
              >
                {result.coverage.summarizedMessageCount === 0
                  ? "No messages were summarized."
                  : `${result.coverage.summarizedMessageCount} message${
                      result.coverage.summarizedMessageCount === 1
                        ? ""
                        : "s"
                    } summarized`}
              </p>

              {/* Mark as read */}
              {showMarkAsRead && (
                <div className="border-theme border-t pt-4">
                  {markReadError && (
                    <p
                      className="feedback feedback-error mb-3"
                      role="alert"
                    >
                      {markReadError}
                    </p>
                  )}
                  <button
                    id="ai-summary-mark-read-btn"
                    type="button"
                    onClick={handleMarkAsRead}
                    disabled={isMarkingRead}
                    className="button button-secondary"
                    aria-busy={isMarkingRead}
                  >
                    {isMarkingRead ? (
                      <span className="spinner" aria-hidden="true" />
                    ) : (
                      <CheckIcon className="size-4" />
                    )}
                    {isMarkingRead
                      ? "Marking as read..."
                      : "Mark summarized messages as read"}
                  </button>
                </div>
              )}

              {/* Mark-as-read confirmation */}
              {markReadSuccess && (
                <p
                  className="feedback feedback-success"
                  role="status"
                  id="ai-summary-mark-read-success"
                >
                  Messages marked as read.
                </p>
              )}
            </div>
          )}

          {/* Idle state */}
          {!result && !error && !isGenerating && (
            <div
              className="flex min-h-32 flex-col items-center justify-center gap-2 text-center"
              aria-hidden="true"
            >
              <span
                className="accent-tile flex size-10 items-center justify-center rounded-full"
              >
                <SparklesIcon className="size-5" />
              </span>
              <p className="text-muted mt-2 text-sm">
                Choose a summary type and click Generate.
              </p>
            </div>
          )}

          {/* Loading state */}
          {isGenerating && (
            <div
              className="flex min-h-32 flex-col items-center justify-center gap-3"
              role="status"
              aria-live="polite"
              id="ai-summary-loading"
            >
              <span className="spinner text-accent" aria-hidden="true" />
              <p className="text-muted text-sm">Generating summary...</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-theme shrink-0 border-t px-5 py-4 sm:px-6">
          <button
            id="ai-summary-generate-btn"
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating || isMarkingRead}
            className="button button-primary w-full"
            aria-busy={isGenerating}
          >
            {isGenerating ? (
              <span className="spinner" aria-hidden="true" />
            ) : (
              <SparklesIcon className="size-4" />
            )}
            {isGenerating ? "Generating summary..." : "Generate"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AiSummaryDialog;
