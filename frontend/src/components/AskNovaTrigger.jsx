import { useCallback, useState } from "react";

import AskNovaDialog from "./AskNovaDialog.jsx";
import { SparklesIcon } from "./Icons.jsx";

function AskNovaTrigger({ workspaceId }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleOpen = useCallback(() => {
    setIsDialogOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setIsDialogOpen(false);
  }, []);

  return (
    <>
      <button
        id="ask-nova-trigger-btn"
        type="button"
        onClick={handleOpen}
        className="button button-secondary shrink-0"
        aria-haspopup="dialog"
      >
        <SparklesIcon className="size-4" />
        <span>Ask Nova</span>
      </button>

      {isDialogOpen && (
        <AskNovaDialog
          workspaceId={workspaceId}
          onClose={handleClose}
        />
      )}
    </>
  );
}

export default AskNovaTrigger;
