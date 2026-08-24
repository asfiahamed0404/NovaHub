import { useRef, useState } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import AdminDialog from "../components/AdminDialog.jsx";

function DialogHarness({ isBusy = false }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <button type="button" onClick={() => setIsOpen(true)}>
        Open admin dialog
      </button>
      {isOpen && (
        <AdminDialog
          title="Account controls"
          description="Review an intentional account change."
          onClose={() => setIsOpen(false)}
          isBusy={isBusy}
          footer={<button type="button">Footer action</button>}
        >
          <label htmlFor="dialog-field">Account note</label>
          <input id="dialog-field" />
          <button type="button">Body action</button>
        </AdminDialog>
      )}
    </div>
  );
}

function CustomFocusDialogHarness() {
  const [isOpen, setIsOpen] = useState(false);
  const [showOpener, setShowOpener] = useState(true);
  const initialFocusRef = useRef(null);
  const returnFocusRef = useRef(null);

  const closeDialog = () => {
    setShowOpener(false);
    setIsOpen(false);
  };

  return (
    <div>
      <button ref={returnFocusRef} type="button">
        Stable return target
      </button>
      {showOpener && (
        <button type="button" onClick={() => setIsOpen(true)}>
          Open custom-focus dialog
        </button>
      )}
      {isOpen && (
        <AdminDialog
          title="Custom focus"
          onClose={closeDialog}
          initialFocusRef={initialFocusRef}
          returnFocusRef={returnFocusRef}
        >
          <label htmlFor="custom-focus-field">Confirmation</label>
          <input ref={initialFocusRef} id="custom-focus-field" />
        </AdminDialog>
      )}
    </div>
  );
}

beforeEach(() => {
  document.body.style.overflow = "";
});

afterEach(() => {
  document.body.style.overflow = "";
});

describe("AdminDialog", () => {
  it("mounts through a portal, labels itself, focuses Close, and locks body scroll", async () => {
    const user = userEvent.setup();
    const rendered = render(<DialogHarness />);

    await user.click(screen.getByRole("button", { name: "Open admin dialog" }));

    const dialog = screen.getByRole("dialog", { name: "Account controls" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription(
      "Review an intentional account change."
    );
    expect(rendered.container.querySelector('[role="dialog"]')).toBeNull();
    expect(
      within(dialog).getByRole("button", { name: "Close Account controls" })
    ).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("closes on Escape, removes the portal, restores scroll, and returns focus", async () => {
    const user = userEvent.setup();
    document.body.style.overflow = "auto";
    render(<DialogHarness />);

    const opener = screen.getByRole("button", { name: "Open admin dialog" });
    await user.click(opener);
    expect(screen.getByRole("dialog", { name: "Account controls" })).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: "Account controls" })).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("auto");
    expect(opener).toHaveFocus();
  });

  it("wraps keyboard focus from the first to last control and back", async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);

    await user.click(screen.getByRole("button", { name: "Open admin dialog" }));
    const dialog = screen.getByRole("dialog", { name: "Account controls" });
    const closeButton = within(dialog).getByRole("button", {
      name: "Close Account controls",
    });
    const footerButton = within(dialog).getByRole("button", {
      name: "Footer action",
    });
    expect(closeButton).toHaveFocus();
    await user.tab({ shift: true });
    expect(footerButton).toHaveFocus();

    await user.tab();
    expect(closeButton).toHaveFocus();
  });

  it("supports explicit initial focus and a stable fallback when the opener is removed", async () => {
    const user = userEvent.setup();
    render(<CustomFocusDialogHarness />);

    await user.click(
      screen.getByRole("button", { name: "Open custom-focus dialog" })
    );

    expect(screen.getByLabelText("Confirmation")).toHaveFocus();
    await user.keyboard("{Escape}");

    expect(
      screen.queryByRole("dialog", { name: "Custom focus" })
    ).not.toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Stable return target" })
      ).toHaveFocus();
    });
  });

  it("prevents Close, Escape, and backdrop dismissal while busy", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <AdminDialog
        title="Busy operation"
        onClose={onClose}
        isBusy
      >
        <p>Saving changes</p>
      </AdminDialog>
    );

    const dialog = screen.getByRole("dialog", { name: "Busy operation" });
    const closeButton = within(dialog).getByRole("button", {
      name: "Close Busy operation",
    });
    expect(closeButton).toBeDisabled();

    fireEvent.keyDown(dialog, { key: "Escape" });
    fireEvent.mouseDown(dialog.parentElement);
    fireEvent.click(closeButton);
    expect(onClose).not.toHaveBeenCalled();

    rerender(
      <AdminDialog
        title="Busy operation"
        onClose={onClose}
        isBusy={false}
      >
        <p>Saving changes</p>
      </AdminDialog>
    );
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("restores the prior body state and focus when its owner unmounts", () => {
    const priorButton = document.createElement("button");
    priorButton.textContent = "Prior focus";
    document.body.appendChild(priorButton);
    priorButton.focus();
    document.body.style.overflow = "scroll";

    const { unmount } = render(
      <AdminDialog title="Unmount test" onClose={vi.fn()}>
        <p>Temporary dialog</p>
      </AdminDialog>
    );

    expect(screen.getByRole("dialog", { name: "Unmount test" })).toBeInTheDocument();
    unmount();

    expect(screen.queryByRole("dialog", { name: "Unmount test" })).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("scroll");
    expect(priorButton).toHaveFocus();
    priorButton.remove();
  });
});
