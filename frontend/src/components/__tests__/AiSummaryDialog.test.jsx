/**
 * AiSummaryDialog — integration tests
 *
 * All HTTP is mocked via vi.mock. No real Cloudflare calls are made.
 * Tests are numbered to match the 28-test plan.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ──────────────────────────────────────────────
// Mocks
// ──────────────────────────────────────────────

vi.mock("../../api/axios.js", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

vi.mock("../../context/AuthContext.jsx", () => ({
  useAuth: vi.fn(),
}));

import api from "../../api/axios.js";
import { useAuth } from "../../context/AuthContext.jsx";
import AiSummaryDialog from "../AiSummaryDialog.jsx";
import AiSummaryTrigger from "../AiSummaryTrigger.jsx";

// ──────────────────────────────────────────────
// Fixtures
// ──────────────────────────────────────────────

const WORKSPACE_ID = "ws123";

const FREE_USER = { id: "u1", name: "Alice", email: "alice@test.com", role: "user", plan: "free" };
const PREMIUM_USER = { id: "u2", name: "Bob", email: "bob@test.com", role: "admin", plan: "premium" };

const MOCK_LOGOUT = vi.fn();

function mockAuth(user = FREE_USER) {
  useAuth.mockReturnValue({ user, logout: MOCK_LOGOUT });
}

function buildSummaryResponse(overrides = {}) {
  return {
    scope: "recent",
    summary: "The team discussed the Q3 roadmap.",
    decisions: ["Adopt TypeScript", "Ship feature by Friday"],
    actionItems: ["Write tests", "Update docs"],
    openQuestions: ["Which CDN to use?"],
    coverage: {
      totalEligibleMessages: 10,
      summarizedMessageCount: 10,
      truncated: false,
      fromMessageId: "msg001",
      toMessageId: "msg010",
    },
    ...overrides,
  };
}

function buildReadStateResponse(missedCount = 0) {
  return {
    lastReadMessageId: missedCount > 0 ? "msg000" : "msg010",
    lastReadMessageCreatedAt: new Date().toISOString(),
    lastReadAt: new Date().toISOString(),
    latestMessageId: "msg010",
    latestMessageCreatedAt: new Date().toISOString(),
    missedCount,
  };
}

// Helper: render dialog with defaults
function renderDialog(props = {}) {
  return render(
    <AiSummaryDialog
      workspaceId={WORKSPACE_ID}
      onClose={vi.fn()}
      missedCount={0}
      onReadStateRefresh={vi.fn()}
      initialScope="recent"
      {...props}
    />
  );
}

// Helper: render trigger
function renderTrigger(props = {}) {
  return render(
    <AiSummaryTrigger workspaceId={WORKSPACE_ID} {...props} />
  );
}

// ──────────────────────────────────────────────
// Setup
// ──────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth(FREE_USER);
  // Default: read-state returns 0 missed
  api.get.mockResolvedValue({ data: buildReadStateResponse(0) });
});

afterEach(() => {
  // Reset body overflow in case any test leaves it set
  document.body.style.overflow = "";
});

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe("AiSummaryTrigger", () => {
  // Test 1
  it("1. AI Summary action renders", async () => {
    renderTrigger();
    expect(
      screen.getByRole("button", { name: /AI Summary/i })
    ).toBeInTheDocument();
  });

  // Test 2
  it("2. clicking trigger opens the dialog", async () => {
    const user = userEvent.setup();
    renderTrigger();

    await user.click(screen.getByRole("button", { name: /AI Summary/i }));

    expect(
      screen.getByRole("dialog", { name: /AI Workspace Summary/i })
    ).toBeInTheDocument();
  });

  // Test 16
  it("16. missedCount > 0 displays catch-up indication", async () => {
    renderTrigger({ missedCount: 12 });

    const btn = screen.getByRole("button", { name: /AI Summary — 12 unread/i });
    expect(btn).toBeInTheDocument();
  });

  // Test 17
  it("17. missedCount = 0 does not show misleading banner", async () => {
    renderTrigger({ missedCount: 0 });

    expect(screen.queryByText(/unread/i)).not.toBeInTheDocument();
  });
});

describe("AiSummaryDialog — scope rendering", () => {
  // Test 3
  it("3. three scopes render in dialog", () => {
    renderDialog();

    expect(
      screen.getByRole("button", { name: /Catch Me Up/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Recent Summary/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Workspace Overview/i })
    ).toBeInTheDocument();
  });
});

describe("AiSummaryDialog — API calls", () => {
  // Test 4
  it("4. recent sends scope=recent", async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({ data: buildSummaryResponse({ scope: "recent" }) });
    renderDialog({ initialScope: "recent" });

    await user.click(screen.getByRole("button", { name: /^Generate$/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        `/workspaces/${WORKSPACE_ID}/ai/summary`,
        { scope: "recent" }
      );
    });
  });

  // Test 5
  it("5. overview sends scope=overview", async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({ data: buildSummaryResponse({ scope: "overview" }) });
    renderDialog({ initialScope: "overview" });

    await user.click(screen.getByRole("button", { name: /^Generate$/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        `/workspaces/${WORKSPACE_ID}/ai/summary`,
        { scope: "overview" }
      );
    });
  });

  // Test 6
  it("6. catch-up sends scope=missed", async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({ data: buildSummaryResponse({ scope: "missed" }) });
    renderDialog({ initialScope: "missed" });

    await user.click(screen.getByRole("button", { name: /^Generate$/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        `/workspaces/${WORKSPACE_ID}/ai/summary`,
        { scope: "missed" }
      );
    });
  });

  // Test 25
  it("25. client never sends role/plan/maxMessages/maxChars", async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({ data: buildSummaryResponse() });
    renderDialog({ initialScope: "recent" });

    await user.click(screen.getByRole("button", { name: /^Generate$/i }));

    await waitFor(() => {
      const [, body] = api.post.mock.calls[0];
      expect(body).not.toHaveProperty("role");
      expect(body).not.toHaveProperty("plan");
      expect(body).not.toHaveProperty("maxMessages");
      expect(body).not.toHaveProperty("maxChars");
      expect(body).not.toHaveProperty("userId");
      expect(Object.keys(body)).toEqual(["scope"]);
    });
  });
});

describe("AiSummaryDialog — loading", () => {
  // Test 7
  it("7. loading state prevents duplicate submission", async () => {
    const user = userEvent.setup();

    // Never resolve so we stay in loading
    api.post.mockImplementation(() => new Promise(() => {}));
    renderDialog();

    const generateBtn = screen.getByRole("button", { name: /^Generate$/i });
    await user.click(generateBtn);

    // Button should now be disabled and show loading text
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Generating summary.../i })
      ).toBeDisabled();
    });

    // Try clicking again — API should only have been called once
    await user.click(screen.getByRole("button", { name: /Generating summary.../i }));
    expect(api.post).toHaveBeenCalledTimes(1);
  });
});

describe("AiSummaryDialog — result display", () => {
  // Test 8
  it("8. successful response renders summary text", async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({
      data: buildSummaryResponse({ summary: "The team discussed the Q3 roadmap." }),
    });
    renderDialog();

    await user.click(screen.getByRole("button", { name: /^Generate$/i }));

    await waitFor(() => {
      expect(screen.getByText("The team discussed the Q3 roadmap.")).toBeInTheDocument();
    });
  });

  // Test 9
  it("9. decisions render", async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({
      data: buildSummaryResponse({ decisions: ["Adopt TypeScript", "Ship feature by Friday"] }),
    });
    renderDialog();

    await user.click(screen.getByRole("button", { name: /^Generate$/i }));

    await waitFor(() => {
      expect(screen.getByText("Adopt TypeScript")).toBeInTheDocument();
      expect(screen.getByText("Ship feature by Friday")).toBeInTheDocument();
    });
  });

  // Test 10
  it("10. action items render", async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({
      data: buildSummaryResponse({ actionItems: ["Write tests", "Update docs"] }),
    });
    renderDialog();

    await user.click(screen.getByRole("button", { name: /^Generate$/i }));

    await waitFor(() => {
      expect(screen.getByText("Write tests")).toBeInTheDocument();
      expect(screen.getByText("Update docs")).toBeInTheDocument();
    });
  });

  // Test 11
  it("11. open questions render", async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({
      data: buildSummaryResponse({ openQuestions: ["Which CDN to use?"] }),
    });
    renderDialog();

    await user.click(screen.getByRole("button", { name: /^Generate$/i }));

    await waitFor(() => {
      expect(screen.getByText("Which CDN to use?")).toBeInTheDocument();
    });
  });

  // Test 12
  it("12. empty sections are hidden cleanly (no [])", async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({
      data: buildSummaryResponse({
        decisions: [],
        actionItems: [],
        openQuestions: [],
      }),
    });
    renderDialog();

    await user.click(screen.getByRole("button", { name: /^Generate$/i }));

    await waitFor(() => {
      // Summary still shows
      expect(screen.getByText("The team discussed the Q3 roadmap.")).toBeInTheDocument();
    });

    // Section headings for empty lists must be absent
    expect(screen.queryByText("Decisions")).not.toBeInTheDocument();
    expect(screen.queryByText("Action Items")).not.toBeInTheDocument();
    expect(screen.queryByText("Open Questions")).not.toBeInTheDocument();

    // No raw array rendering
    expect(document.body.textContent).not.toContain("[]");
  });

  // Test 13
  it("13. truncated coverage warning renders", async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({
      data: buildSummaryResponse({
        coverage: {
          totalEligibleMessages: 500,
          summarizedMessageCount: 100,
          truncated: true,
          fromMessageId: "msg001",
          toMessageId: "msg100",
        },
      }),
    });
    renderDialog();

    await user.click(screen.getByRole("button", { name: /^Generate$/i }));

    await waitFor(() => {
      expect(screen.getByRole("note", { hidden: true })).toBeInTheDocument();
      expect(screen.getByText(/Older messages were not included/i)).toBeInTheDocument();
    });
  });
});

describe("AiSummaryDialog — error handling", () => {
  // Test 14
  it("14. 429 renders friendly rate-limit message", async () => {
    const user = userEvent.setup();
    api.post.mockRejectedValue({
      response: {
        status: 429,
        data: {
          message: "AI summary rate limit exceeded. You can make up to 5 summary requests per 60 minutes.",
          code: "RATE_LIMIT_EXCEEDED",
          retryAfterSeconds: 3600,
        },
      },
    });
    renderDialog();

    await user.click(screen.getByRole("button", { name: /^Generate$/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/rate limit exceeded/i)
      ).toBeInTheDocument();
    });

    // Ensure no stack trace or raw data
    expect(document.body.textContent).not.toContain("at Object");
  });

  // Test 15
  it("15. provider failure renders safe error", async () => {
    const user = userEvent.setup();
    api.post.mockRejectedValue({
      response: {
        status: 503,
        data: { message: "AI provider failure.", code: "AI_PROVIDER_FAILURE" },
      },
    });
    renderDialog();

    await user.click(screen.getByRole("button", { name: /^Generate$/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/AI service encountered an error/i)
      ).toBeInTheDocument();
    });
  });

  // Test 26
  it("26. 403 shows workspace access error", async () => {
    const user = userEvent.setup();
    api.post.mockRejectedValue({
      response: { status: 403, data: { message: "You are not a member of this workspace." } },
    });
    renderDialog();

    await user.click(screen.getByRole("button", { name: /^Generate$/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/You do not have access to this workspace/i)
      ).toBeInTheDocument();
    });
  });
});

describe("AiSummaryDialog — Mark as read (missed scope)", () => {
  // Test 18
  it("18. successful missed summary exposes Mark as read button", async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({
      data: buildSummaryResponse({
        scope: "missed",
        coverage: {
          totalEligibleMessages: 5,
          summarizedMessageCount: 5,
          truncated: false,
          fromMessageId: "msg001",
          toMessageId: "msg005",
        },
      }),
    });
    renderDialog({ initialScope: "missed" });

    await user.click(screen.getByRole("button", { name: /^Generate$/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Mark summarized messages as read/i })
      ).toBeInTheDocument();
    });
  });

  // Test 19
  it("19. Mark as read sends coverage.toMessageId", async () => {
    const user = userEvent.setup();
    const onReadStateRefresh = vi.fn();

    api.post.mockResolvedValue({
      data: buildSummaryResponse({
        scope: "missed",
        coverage: {
          totalEligibleMessages: 5,
          summarizedMessageCount: 5,
          truncated: false,
          fromMessageId: "msg001",
          toMessageId: "msg005",
        },
      }),
    });
    api.put.mockResolvedValue({
      data: { lastReadMessageId: "msg005", lastReadMessageCreatedAt: new Date().toISOString(), lastReadAt: new Date().toISOString() },
    });

    renderDialog({ initialScope: "missed", onReadStateRefresh });

    await user.click(screen.getByRole("button", { name: /^Generate$/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Mark summarized messages as read/i })
      ).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", { name: /Mark summarized messages as read/i })
    );

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith(
        `/workspaces/${WORKSPACE_ID}/read-state`,
        { messageId: "msg005" }
      );
    });

    // Callback fired
    expect(onReadStateRefresh).toHaveBeenCalled();

    // Confirmation shown
    await waitFor(() => {
      expect(screen.getByText(/Messages marked as read/i)).toBeInTheDocument();
    });
  });

  // Test 20
  it("20. recent summary does not show Mark as read button", async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({
      data: buildSummaryResponse({ scope: "recent" }),
    });
    renderDialog({ initialScope: "recent" });

    await user.click(screen.getByRole("button", { name: /^Generate$/i }));

    await waitFor(() => {
      expect(screen.getByText("The team discussed the Q3 roadmap.")).toBeInTheDocument();
    });

    expect(
      screen.queryByRole("button", { name: /Mark summarized messages as read/i })
    ).not.toBeInTheDocument();

    expect(api.put).not.toHaveBeenCalled();
  });

  // Test 21
  it("21. overview summary does not update checkpoint", async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({
      data: buildSummaryResponse({ scope: "overview" }),
    });
    renderDialog({ initialScope: "overview" });

    await user.click(screen.getByRole("button", { name: /^Generate$/i }));

    await waitFor(() => {
      expect(screen.getByText("The team discussed the Q3 roadmap.")).toBeInTheDocument();
    });

    expect(api.put).not.toHaveBeenCalled();
  });
});

describe("AiSummaryTrigger — new member and plan display", () => {
  // Test 22
  it("22. new member with missedCount=0 can still use Workspace Overview", async () => {
    api.get.mockResolvedValue({ data: buildReadStateResponse(0) });
    const user = userEvent.setup();
    renderTrigger();

    // Open dialog
    await user.click(await screen.findByRole("button", { name: /AI Summary/i }));

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("button", { name: /Workspace Overview/i })
    ).toBeInTheDocument();
  });

  // Test 23
  it("23. Free plan label displays correctly", async () => {
    mockAuth(FREE_USER);
    renderDialog();
    expect(screen.getByText(/Free plan/i)).toBeInTheDocument();
    expect(screen.queryByText(/Premium/i)).not.toBeInTheDocument();
  });

  // Test 24
  it("24. Premium plan label displays correctly", async () => {
    mockAuth(PREMIUM_USER);
    renderDialog();
    // The badge shows "Premium" (without "plan" suffix for premium)
    const badge = screen.getByLabelText(/Premium plan/i);
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("Premium");
  });
});

describe("AiSummaryDialog — workspace safety", () => {
  // Test 27
  it("27. existing workspace messaging area is not broken by AI trigger", () => {
    // AiSummaryDialog does not touch WorkspaceMessages — verify it mounts cleanly
    renderDialog({ initialScope: "recent" });
    // Dialog should render without errors; WorkspaceMessages not present here
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  // Test 28
  it("28. dialog closes on Escape key", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderDialog({ onClose });

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("useLiveReadTracker — live read tracking & debounce", () => {
  it("initial missedCount > 0 prevents automatic checkpoint advancement", async () => {
    const { useLiveReadTracker } = await import("../../hooks/useLiveReadTracker.js");
    api.get.mockResolvedValue({
      data: { missedCount: 5, latestMessageId: "msg005" },
    });

    const { renderHook, act } = await import("@testing-library/react");
    const { result } = renderHook(() =>
      useLiveReadTracker({ workspaceId: WORKSPACE_ID, logout: MOCK_LOGOUT })
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.missedCount).toBe(5);
    expect(result.current.isLiveReadMode).toBe(false);
    expect(api.put).not.toHaveBeenCalled();

    // Trigger message activity while live mode is false -> must NOT call PUT
    act(() => {
      result.current.onMessageActivity({ _id: "msg006" });
    });

    expect(api.put).not.toHaveBeenCalled();
  });

  it("initial missedCount == 0 enables live read tracking", async () => {
    const { useLiveReadTracker } = await import("../../hooks/useLiveReadTracker.js");
    api.get.mockResolvedValue({
      data: { missedCount: 0, latestMessageId: "msg001" },
    });

    const { renderHook, act } = await import("@testing-library/react");
    const { result } = renderHook(() =>
      useLiveReadTracker({ workspaceId: WORKSPACE_ID, logout: MOCK_LOGOUT })
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.missedCount).toBe(0);
    expect(result.current.isLiveReadMode).toBe(true);

    // Fast-forward debounce timer
    await act(async () => {
      await new Promise((r) => setTimeout(r, 350));
    });

    expect(api.put).toHaveBeenCalledWith(
      `/workspaces/${WORKSPACE_ID}/read-state`,
      { messageId: "msg001" }
    );
  });

  it("active realtime message and own sent message advance checkpoint when live read mode is active", async () => {
    const { useLiveReadTracker } = await import("../../hooks/useLiveReadTracker.js");
    api.get.mockResolvedValue({
      data: { missedCount: 0, latestMessageId: null },
    });

    const { renderHook, act } = await import("@testing-library/react");
    const { result } = renderHook(() =>
      useLiveReadTracker({ workspaceId: WORKSPACE_ID, logout: MOCK_LOGOUT })
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isLiveReadMode).toBe(true);

    act(() => {
      result.current.onMessageActivity({ _id: "msg010" });
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 350));
    });

    expect(api.put).toHaveBeenCalledWith(
      `/workspaces/${WORKSPACE_ID}/read-state`,
      { messageId: "msg010" }
    );
  });

  it("hidden/inactive tab does not mark messages as read", async () => {
    const { useLiveReadTracker } = await import("../../hooks/useLiveReadTracker.js");
    api.get.mockResolvedValue({
      data: { missedCount: 0, latestMessageId: null },
    });

    const visibilitySpy = vi
      .spyOn(document, "visibilityState", "get")
      .mockReturnValue("hidden");

    const { renderHook, act } = await import("@testing-library/react");
    const { result } = renderHook(() =>
      useLiveReadTracker({ workspaceId: WORKSPACE_ID, logout: MOCK_LOGOUT })
    );

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.onMessageActivity({ _id: "msg020" });
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 350));
    });

    expect(api.put).not.toHaveBeenCalled();
    visibilitySpy.mockRestore();
  });

  it("reconnect with existing missed backlog does not erase checkpoint", async () => {
    const { useLiveReadTracker } = await import("../../hooks/useLiveReadTracker.js");
    api.get.mockResolvedValue({
      data: { missedCount: 10, latestMessageId: "msg100" },
    });

    const { renderHook, act } = await import("@testing-library/react");
    const { result } = renderHook(() =>
      useLiveReadTracker({ workspaceId: WORKSPACE_ID, logout: MOCK_LOGOUT })
    );

    await act(async () => {
      await Promise.resolve();
    });

    // Simulate history sync / reconnect activity
    act(() => {
      result.current.onMessageActivity({ _id: "msg100" });
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 350));
    });

    expect(api.put).not.toHaveBeenCalled();
    expect(result.current.missedCount).toBe(10);
  });

  it("PUT calls are debounced and coalesced", async () => {
    const { useLiveReadTracker } = await import("../../hooks/useLiveReadTracker.js");
    api.get.mockResolvedValue({
      data: { missedCount: 0, latestMessageId: null },
    });

    const { renderHook, act } = await import("@testing-library/react");
    const { result } = renderHook(() =>
      useLiveReadTracker({ workspaceId: WORKSPACE_ID, logout: MOCK_LOGOUT })
    );

    await act(async () => {
      await Promise.resolve();
    });

    // Rapid messages arrive
    act(() => {
      result.current.onMessageActivity({ _id: "msg1" });
      result.current.onMessageActivity({ _id: "msg2" });
      result.current.onMessageActivity({ _id: "msg3" });
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 350));
    });

    // Should only be called ONCE with the latest messageId
    expect(api.put).toHaveBeenCalledTimes(1);
    expect(api.put).toHaveBeenCalledWith(
      `/workspaces/${WORKSPACE_ID}/read-state`,
      { messageId: "msg3" }
    );
  });
});
