import { useCallback, useState } from "react";
import { SparklesIcon } from "./Icons.jsx";
import AiSummaryDialog from "./AiSummaryDialog.jsx";

/**
 * AiSummaryTrigger
 *
 * Renders the "✨ AI Summary" button in the workspace header.
 * Displays missedCount badge passed from parent tracker.
 * Does NOT advance read-state automatically on open.
 */
function AiSummaryTrigger({
  workspaceId,
  missedCount = 0,
  onReadStateRefresh,
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [initialScope, setInitialScope] = useState("recent");

  const handleOpen = useCallback(() => {
    // Pre-select "Catch Me Up" if there are missed messages, else "Recent"
    setInitialScope(missedCount > 0 ? "missed" : "recent");
    setIsDialogOpen(true);
  }, [missedCount]);

  const handleClose = useCallback(() => {
    setIsDialogOpen(false);
  }, []);

  return (
    <>
      <button
        id="ai-summary-trigger-btn"
        type="button"
        onClick={handleOpen}
        className="button button-secondary shrink-0"
        aria-haspopup="dialog"
        aria-label={
          missedCount > 0
            ? `AI Summary — ${missedCount} unread message${missedCount === 1 ? "" : "s"}`
            : "AI Summary"
        }
      >
        <SparklesIcon className="size-4" />
        <span className="hidden sm:inline">AI Summary</span>
        {missedCount > 0 && (
          <span className="missed-badge" aria-hidden="true">
            {missedCount > 99 ? "99+" : missedCount}
          </span>
        )}
      </button>

      {isDialogOpen && (
        <AiSummaryDialog
          workspaceId={workspaceId}
          onClose={handleClose}
          missedCount={missedCount}
          onReadStateRefresh={onReadStateRefresh}
          initialScope={initialScope}
        />
      )}
    </>
  );
}

export default AiSummaryTrigger;
