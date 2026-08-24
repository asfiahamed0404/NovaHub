import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import api from "../api/axios.js";
import { useAuth } from "../context/AuthContext.jsx";
import { CloseIcon, SparklesIcon } from "./Icons.jsx";

const MAX_QUESTION_CHARS = 2000;

const PROVIDER_ERROR_MESSAGES = {
  AI_PROVIDER_UNCONFIGURED:
    "Ask Nova is not available right now. Please try again later.",
  AI_PROVIDER_TIMEOUT:
    "Nova took too long to respond. Please try again.",
  AI_PROVIDER_FAILURE:
    "Nova couldn't answer that right now. Please try again.",
  AI_PROVIDER_FAILED:
    "Nova couldn't answer that right now. Please try again.",
  AI_PROVIDER_QUOTA_EXCEEDED:
    "Ask Nova is temporarily unavailable. Please try again later.",
  AI_PROVIDER_MALFORMED_RESPONSE:
    "Nova returned an unexpected response. Please try again.",
  AI_PROVIDER_INCOMPLETE_GENERATION:
    "Nova returned an incomplete response. Please try again.",
  AGENT_PROVIDER_FAILED:
    "Nova couldn't answer that right now. Please try again.",
};

const getAgentErrorMessage = (error) => {
  const status = error.response?.status;
  const data = error.response?.data;

  if (status === 401) {
    return "Your session expired. Please sign in again.";
  }

  if (status === 403 && data?.code === "AI_NOT_ENTITLED") {
    return "Ask Nova is not included with your current plan.";
  }

  if (status === 403) {
    return "You do not have access to this workspace.";
  }

  if (status === 429) {
    return (
      data?.message ||
      "You have reached the AI request limit. Please try again later."
    );
  }

  if (data?.code && PROVIDER_ERROR_MESSAGES[data.code]) {
    return PROVIDER_ERROR_MESSAGES[data.code];
  }

  if (status === 400 && typeof data?.message === "string") {
    return data.message;
  }

  return "Nova couldn't answer that right now. Please try again.";
};

function AskNovaDialog({ workspaceId, onClose }) {
  const { logout } = useAuth();
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const inputRef = useRef(null);
  const isSubmittingRef = useRef(false);

  const [question, setQuestion] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";
    inputRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();

        if (!isSubmittingRef.current) {
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
      } else if (event.shiftKey && document.activeElement === first) {
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

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();

      const normalizedQuestion = question.trim();

      if (!normalizedQuestion || isSubmittingRef.current) {
        return;
      }

      isSubmittingRef.current = true;
      setIsSubmitting(true);
      setError("");
      setResult(null);

      try {
        const response = await api.post(
          `/workspaces/${workspaceId}/ai/agent`,
          { question: normalizedQuestion }
        );

        if (typeof response.data?.answer !== "string") {
          throw new Error("Invalid Workspace Agent response");
        }

        setResult(response.data);
        setQuestion("");
      } catch (requestError) {
        setError(getAgentErrorMessage(requestError));

        if (requestError.response?.status === 401) {
          logout();
        }
      } finally {
        isSubmittingRef.current = false;
        setIsSubmitting(false);
      }
    },
    [logout, question, workspaceId]
  );

  const safeToolCount = Array.isArray(result?.toolsUsed)
    ? new Set(
        result.toolsUsed.filter((tool) => typeof tool === "string")
      ).size
    : 0;
  const canSubmit =
    question.trim().length > 0 && !isSubmitting;

  return (
    <div
      className="invite-dialog-backdrop fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
      role="presentation"
      onClick={(event) => {
        if (
          event.target === event.currentTarget &&
          !isSubmittingRef.current
        ) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        id="ask-nova-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ask-nova-dialog-title"
        aria-describedby="ask-nova-dialog-description"
        className="surface-panel flex w-full max-w-xl flex-col overflow-hidden"
        style={{ maxHeight: "90dvh" }}
      >
        <div className="border-theme flex shrink-0 items-center gap-3 border-b px-5 py-4 sm:px-6">
          <span
            className="accent-tile flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)]"
            aria-hidden="true"
          >
            <SparklesIcon className="size-4" />
          </span>

          <div className="min-w-0 flex-1">
            <h2
              id="ask-nova-dialog-title"
              className="text-heading font-semibold"
            >
              Ask Nova
            </h2>
            <p className="text-muted text-xs">
              Answers from this workspace only
            </p>
          </div>

          <button
            ref={closeButtonRef}
            id="ask-nova-dialog-close"
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="button button-secondary px-3"
            aria-label="Close Ask Nova dialog"
          >
            <CloseIcon className="size-4" />
          </button>
        </div>

        <div className="scroll-area min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <p
            id="ask-nova-dialog-description"
            className="text-muted text-sm leading-6"
          >
            Ask Nova about messages, decisions, tasks, and context in
            the current workspace.
          </p>

          {result && !error && (
            <section
              className="surface-subtle mt-5 p-4 sm:p-5"
              aria-labelledby="ask-nova-answer-label"
              role="status"
              aria-live="polite"
            >
              <p
                id="ask-nova-answer-label"
                className="ai-summary-section-label"
              >
                Nova
              </p>
              <p
                id="ask-nova-answer"
                className="ai-summary-text"
              >
                {result.answer}
              </p>
              {safeToolCount > 0 && (
                <p
                  id="ask-nova-tool-count"
                  className="text-muted border-theme mt-4 border-t pt-3 text-xs"
                >
                  Checked {safeToolCount} workspace tool
                  {safeToolCount === 1 ? "" : "s"}.
                </p>
              )}
            </section>
          )}

          {error && (
            <p
              id="ask-nova-error"
              className="feedback feedback-error mt-5"
              role="alert"
            >
              {error}
            </p>
          )}

          {isSubmitting && (
            <div
              id="ask-nova-loading"
              className="mt-5 flex items-center gap-3"
              role="status"
              aria-live="polite"
            >
              <span className="spinner" aria-hidden="true" />
              <p className="text-muted text-sm">
                Nova is checking the workspace...
              </p>
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="border-theme mt-5 border-t pt-5"
            aria-busy={isSubmitting}
          >
            <label htmlFor="ask-nova-question" className="form-label">
              Ask about this workspace
            </label>
            <p
              id="ask-nova-question-help"
              className="text-muted mt-1 text-xs leading-5"
            >
              Nova searches only the workspace context you can access.
            </p>

            <input
              ref={inputRef}
              id="ask-nova-question"
              type="text"
              value={question}
              onChange={(event) => {
                setQuestion(event.target.value);
                setError("");
              }}
              placeholder="What did we decide about deployment?"
              maxLength={MAX_QUESTION_CHARS}
              disabled={isSubmitting}
              aria-invalid={Boolean(error)}
              aria-describedby={
                error
                  ? "ask-nova-question-help ask-nova-error"
                  : "ask-nova-question-help"
              }
              className="form-input mt-2"
            />

            <button
              id="ask-nova-submit"
              type="submit"
              disabled={!canSubmit}
              className="button button-primary mt-3 w-full"
              aria-busy={isSubmitting}
            >
              {isSubmitting ? (
                <span className="spinner" aria-hidden="true" />
              ) : (
                <SparklesIcon className="size-4" />
              )}
              {isSubmitting ? "Asking Nova..." : "Ask Nova"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default AskNovaDialog;
