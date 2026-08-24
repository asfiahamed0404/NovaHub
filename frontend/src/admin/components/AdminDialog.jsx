import { useEffect, useId, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { CloseIcon } from "../../components/Icons.jsx";

const DIALOG_WIDTHS = {
  medium: "max-w-xl",
  large: "max-w-2xl",
  wide: "max-w-4xl",
};

const FOCUSABLE_SELECTOR =
  'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])';

function AdminDialog({
  title,
  description,
  onClose,
  children,
  footer,
  isBusy = false,
  size = "large",
  initialFocusRef,
  returnFocusRef,
}) {
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const isBusyRef = useRef(isBusy);
  const onCloseRef = useRef(onClose);
  const returnFocusRefRef = useRef(returnFocusRef);
  const previouslyFocusedElementRef = useRef(null);
  const generatedId = useId();
  const titleId = `admin-dialog-title-${generatedId}`;
  const descriptionId = `admin-dialog-description-${generatedId}`;

  useLayoutEffect(() => {
    isBusyRef.current = isBusy;
    onCloseRef.current = onClose;
    returnFocusRefRef.current = returnFocusRef;
  }, [isBusy, onClose, returnFocusRef]);

  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();

      if (!isBusyRef.current) {
        onCloseRef.current();
      }

      return;
    }

    if (event.key !== "Tab" || !dialogRef.current) {
      return;
    }

    // Filtering one DOM-ordered node list avoids selector-engine differences
    // in how comma-separated query groups are returned.
    const focusableElements = Array.from(
      dialogRef.current.querySelectorAll("*")
    ).filter((element) => element.matches(FOCUSABLE_SELECTOR));

    if (focusableElements.length === 0) {
      event.preventDefault();
      dialogRef.current.focus();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (!dialogRef.current.contains(document.activeElement)) {
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

  useLayoutEffect(() => {
    previouslyFocusedElementRef.current = document.activeElement;
    const previousBodyOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
    };
  }, []);

  useLayoutEffect(() => {
    const initialFocusTarget = initialFocusRef?.current;

    if (
      initialFocusTarget instanceof HTMLElement &&
      dialogRef.current?.contains(initialFocusTarget)
    ) {
      initialFocusTarget.focus();
    } else {
      closeButtonRef.current?.focus();
    }
  }, [initialFocusRef]);

  useEffect(() => {
    return () => {
      const previouslyFocusedElement =
        previouslyFocusedElementRef.current;
      const fallbackFocusTarget =
        returnFocusRefRef.current?.current;
      const focusTarget =
        previouslyFocusedElement instanceof HTMLElement &&
        document.contains(previouslyFocusedElement)
          ? previouslyFocusedElement
          : fallbackFocusTarget instanceof HTMLElement &&
              document.contains(fallbackFocusTarget)
            ? fallbackFocusTarget
            : null;

      if (focusTarget) {
        focusTarget.focus();
      }
    };
  }, []);

  return createPortal(
    <div
      className="invite-dialog-backdrop fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 py-6 sm:px-6 sm:py-8"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !isBusyRef.current
        ) {
          onCloseRef.current();
        }
      }}
    >
      <section
        ref={dialogRef}
        onKeyDownCapture={handleKeyDown}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        aria-busy={isBusy}
        tabIndex={-1}
        className={`surface-panel page-enter my-auto flex max-h-[calc(100dvh-3rem)] w-full flex-col overflow-hidden ${
          DIALOG_WIDTHS[size] || DIALOG_WIDTHS.large
        }`}
      >
        <header className="border-theme flex shrink-0 items-start justify-between gap-4 border-b px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="eyebrow">Admin Console</p>
            <h2
              id={titleId}
              className="text-heading mt-2 break-words text-xl font-semibold tracking-[-0.02em]"
            >
              {title}
            </h2>
            {description && (
              <p
                id={descriptionId}
                className="text-muted mt-2 text-sm leading-6"
              >
                {description}
              </p>
            )}
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="button button-secondary min-h-10 shrink-0 px-3"
            aria-label={`Close ${title}`}
          >
            <CloseIcon className="size-4" />
          </button>
        </header>

        <div className="scroll-area min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {children}
        </div>

        {footer && (
          <footer className="border-theme shrink-0 border-t px-5 py-4 sm:px-6">
            {footer}
          </footer>
        )}
      </section>
    </div>,
    document.body
  );
}

export default AdminDialog;
