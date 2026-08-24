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
const MAX_MEMORY_CONTENT_CHARS = 4000;
const MAX_MEMORY_SOURCE_MESSAGES = 20;
const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;
const MEMORY_TYPES = new Set(["fact", "decision", "task", "note"]);
const MEMORY_IMPORTANCE_LEVELS = new Set([
  "low",
  "normal",
  "high",
]);

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

const normalizeMemoryProposal = (proposal) => {
  if (!proposal || typeof proposal !== "object") {
    return null;
  }

  const content =
    typeof proposal.content === "string"
      ? proposal.content.trim()
      : "";
  const sourceMessageIds = Array.isArray(proposal.sourceMessageIds)
    ? proposal.sourceMessageIds
    : null;

  if (
    !MEMORY_TYPES.has(proposal.type) ||
    !MEMORY_IMPORTANCE_LEVELS.has(proposal.importance) ||
    content.length === 0 ||
    content.length > MAX_MEMORY_CONTENT_CHARS ||
    !sourceMessageIds ||
    sourceMessageIds.length > MAX_MEMORY_SOURCE_MESSAGES ||
    sourceMessageIds.some(
      (sourceId) =>
        typeof sourceId !== "string" ||
        !OBJECT_ID_PATTERN.test(sourceId)
    )
  ) {
    return null;
  }

  return {
    type: proposal.type,
    content,
    importance: proposal.importance,
    sourceMessageIds: [...new Set(sourceMessageIds)],
  };
};

const getMemorySaveErrorMessage = (error) => {
  const status = error.response?.status;

  if (status === 401) {
    return "Your session expired. Please sign in again.";
  }

  if (status === 403) {
    return "You no longer have access to save memory in this workspace.";
  }

  if (status === 400) {
    return "This memory suggestion could not be validated. Ask Nova again for a fresh suggestion.";
  }

  return "The memory couldn't be saved right now. Please try again.";
};

function AskNovaDialog({ workspaceId, onClose }) {
  const { logout } = useAuth();
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const inputRef = useRef(null);
  const isSubmittingRef = useRef(false);
  const isSavingMemoryRef = useRef(false);

  const [question, setQuestion] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [memoryProposal, setMemoryProposal] = useState(null);
  const [isSavingMemory, setIsSavingMemory] = useState(false);
  const [memorySaveError, setMemorySaveError] = useState("");
  const [memorySaveSuccess, setMemorySaveSuccess] = useState(false);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";
    inputRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();

        if (
          !isSubmittingRef.current &&
          !isSavingMemoryRef.current
        ) {
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

      if (
        !normalizedQuestion ||
        isSubmittingRef.current ||
        isSavingMemoryRef.current
      ) {
        return;
      }

      isSubmittingRef.current = true;
      setIsSubmitting(true);
      setError("");
      setResult(null);
      setMemoryProposal(null);
      setMemorySaveError("");
      setMemorySaveSuccess(false);

      try {
        const response = await api.post(
          `/workspaces/${workspaceId}/ai/agent`,
          { question: normalizedQuestion }
        );

        if (typeof response.data?.answer !== "string") {
          throw new Error("Invalid Workspace Agent response");
        }

        setResult(response.data);
        setMemoryProposal(
          normalizeMemoryProposal(response.data.memoryProposal)
        );
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

  const handleSaveMemory = useCallback(async () => {
    if (!memoryProposal || isSavingMemoryRef.current) {
      return;
    }

    isSavingMemoryRef.current = true;
    setIsSavingMemory(true);
    setMemorySaveError("");
    setMemorySaveSuccess(false);

    try {
      await api.post(`/workspaces/${workspaceId}/ai/memories`, {
        type: memoryProposal.type,
        content: memoryProposal.content,
        importance: memoryProposal.importance,
        sourceMessageIds: memoryProposal.sourceMessageIds,
      });

      setMemoryProposal(null);
      setMemorySaveSuccess(true);
    } catch (requestError) {
      setMemorySaveError(getMemorySaveErrorMessage(requestError));

      if (requestError.response?.status === 401) {
        logout();
      }
    } finally {
      isSavingMemoryRef.current = false;
      setIsSavingMemory(false);
    }
  }, [logout, memoryProposal, workspaceId]);

  const handleDismissMemory = useCallback(() => {
    if (isSavingMemoryRef.current) {
      return;
    }

    setMemoryProposal(null);
    setMemorySaveError("");
    setMemorySaveSuccess(false);
  }, []);

  const safeToolCount = Array.isArray(result?.toolsUsed)
    ? new Set(
        result.toolsUsed.filter((tool) => typeof tool === "string")
      ).size
    : 0;
  const canSubmit =
    question.trim().length > 0 &&
    !isSubmitting &&
    !isSavingMemory;
  const isBusy = isSubmitting || isSavingMemory;

  return (
    <div
      className="invite-dialog-backdrop fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
      role="presentation"
      onClick={(event) => {
        if (
          event.target === event.currentTarget &&
          !isSubmittingRef.current &&
          !isSavingMemoryRef.current
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
            disabled={isBusy}
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

          {memoryProposal && result && !error && (
            <section
              className="surface-subtle border-theme mt-4 border p-4 sm:p-5"
              aria-labelledby="ask-nova-memory-title"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3
                    id="ask-nova-memory-title"
                    className="text-heading text-sm font-semibold"
                  >
                    Suggested workspace memory
                  </h3>
                  <p className="text-muted mt-1 text-xs">
                    Suggestion only — not saved yet.
                  </p>
                </div>
                <span className="plan-badge plan-badge-free">
                  {memoryProposal.type}
                </span>
              </div>

              <p
                id="ask-nova-memory-content"
                className="ai-summary-text mt-4"
              >
                {memoryProposal.content}
              </p>
              <p className="text-muted mt-3 text-xs capitalize">
                Importance: {memoryProposal.importance}
              </p>

              {memorySaveError && (
                <p
                  id="ask-nova-memory-error"
                  className="feedback feedback-error mt-4"
                  role="alert"
                >
                  {memorySaveError}
                </p>
              )}

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button
                  id="ask-nova-memory-save"
                  type="button"
                  onClick={handleSaveMemory}
                  disabled={isSavingMemory}
                  className="button button-primary flex-1"
                  aria-busy={isSavingMemory}
                >
                  {isSavingMemory && (
                    <span className="spinner" aria-hidden="true" />
                  )}
                  {isSavingMemory ? "Saving to Memory..." : "Save to Memory"}
                </button>
                <button
                  id="ask-nova-memory-dismiss"
                  type="button"
                  onClick={handleDismissMemory}
                  disabled={isSavingMemory}
                  className="button button-secondary flex-1"
                >
                  Dismiss
                </button>
              </div>
            </section>
          )}

          {memorySaveSuccess && (
            <p
              id="ask-nova-memory-success"
              className="feedback feedback-success mt-4"
              role="status"
              aria-live="polite"
            >
              Saved to workspace memory.
            </p>
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
            aria-busy={isBusy}
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
                setMemorySaveSuccess(false);
              }}
              placeholder="What did we decide about deployment?"
              maxLength={MAX_QUESTION_CHARS}
              disabled={isBusy}
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
