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

vi.mock("../../api/axios.js", () => ({
  default: {
    post: vi.fn(),
  },
}));

vi.mock("../../context/AuthContext.jsx", () => ({
  useAuth: vi.fn(),
}));

import api from "../../api/axios.js";
import { useAuth } from "../../context/AuthContext.jsx";
import AskNovaDialog from "../AskNovaDialog.jsx";
import AskNovaTrigger from "../AskNovaTrigger.jsx";

const WORKSPACE_ID = "workspace-123";
const logout = vi.fn();

const buildAgentResponse = (overrides = {}) => ({
  answer: "The team decided to deploy the backend on Railway.",
  toolsUsed: [
    "list_workspace_memories",
    "search_workspace_messages",
  ],
  steps: [
    {
      step: 1,
      tool: "list_workspace_memories",
      success: true,
    },
  ],
  memoryProposal: null,
  ...overrides,
});

const SOURCE_MESSAGE_ID = "507f1f77bcf86cd799439011";

const buildMemoryProposal = (overrides = {}) => ({
  type: "decision",
  content: "Production backend uses Railway.",
  importance: "high",
  sourceMessageIds: [SOURCE_MESSAGE_ID],
  ...overrides,
});

const renderDialog = (props = {}) =>
  render(
    <AskNovaDialog
      workspaceId={WORKSPACE_ID}
      onClose={vi.fn()}
      {...props}
    />
  );

beforeEach(() => {
  vi.clearAllMocks();
  useAuth.mockReturnValue({ logout });
});

afterEach(() => {
  document.body.style.overflow = "";
});

describe("Ask Nova workspace experience", () => {
  it("1. opens from the Ask Nova workspace action", async () => {
    const user = userEvent.setup();
    render(<AskNovaTrigger workspaceId={WORKSPACE_ID} />);

    await user.click(
      screen.getByRole("button", { name: /^Ask Nova$/i })
    );

    const dialog = screen.getByRole("dialog", { name: "Ask Nova" });
    expect(dialog).toBeInTheDocument();
    expect(
      within(dialog).getByLabelText("Ask about this workspace")
    ).toHaveFocus();
  });

  it("2. accepts a question and sends only its trimmed text", async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({ data: buildAgentResponse() });
    renderDialog();

    const input = screen.getByLabelText("Ask about this workspace");
    await user.type(input, "  What did we decide about deployment?  ");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        `/workspaces/${WORKSPACE_ID}/ai/agent`,
        { question: "What did we decide about deployment?" }
      );
    });
    expect(input).toHaveValue("");
  });

  it("3. prevents empty questions from being submitted", async () => {
    const user = userEvent.setup();
    renderDialog();

    const input = screen.getByLabelText("Ask about this workspace");
    const submit = screen.getByRole("button", { name: /^Ask Nova$/i });

    expect(submit).toBeDisabled();
    await user.type(input, "   ");
    expect(submit).toBeDisabled();
    fireEvent.submit(input.closest("form"));
    expect(api.post).not.toHaveBeenCalled();
  });

  it("4. communicates loading while Nova checks the workspace", async () => {
    const user = userEvent.setup();
    let resolveRequest;
    api.post.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      })
    );
    renderDialog();

    await user.type(
      screen.getByLabelText("Ask about this workspace"),
      "What changed?"
    );
    await user.click(
      screen.getByRole("button", { name: /^Ask Nova$/i })
    );

    expect(
      screen.getByText("Nova is checking the workspace...")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Asking Nova..." })
    ).toBeDisabled();

    resolveRequest({ data: buildAgentResponse() });
    await screen.findByText(buildAgentResponse().answer);
  });

  it("5. renders a successful answer and safe tool count", async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({ data: buildAgentResponse() });
    renderDialog();

    await user.type(
      screen.getByLabelText("Ask about this workspace"),
      "Where will we deploy?"
    );
    await user.click(
      screen.getByRole("button", { name: /^Ask Nova$/i })
    );

    expect(await screen.findByText(buildAgentResponse().answer))
      .toBeInTheDocument();
    expect(screen.getByText("Checked 2 workspace tools."))
      .toBeInTheDocument();
  });

  it("6. renders agent HTML as inert text", async () => {
    const user = userEvent.setup();
    const unsafeAnswer =
      '<img src="x" onerror="window.agentExecuted=true">Answer';
    const { container } = renderDialog();
    api.post.mockResolvedValue({
      data: buildAgentResponse({ answer: unsafeAnswer }),
    });

    await user.type(
      screen.getByLabelText("Ask about this workspace"),
      "Show the answer"
    );
    await user.click(
      screen.getByRole("button", { name: /^Ask Nova$/i })
    );

    expect(await screen.findByText(unsafeAnswer)).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
    expect(window.agentExecuted).toBeUndefined();
  });

  it("7. shows an entitlement-specific 403 message", async () => {
    const user = userEvent.setup();
    api.post.mockRejectedValue({
      response: {
        status: 403,
        data: { code: "AI_NOT_ENTITLED" },
      },
    });
    renderDialog();

    await user.type(
      screen.getByLabelText("Ask about this workspace"),
      "What happened?"
    );
    await user.click(
      screen.getByRole("button", { name: /^Ask Nova$/i })
    );

    expect(
      await screen.findByText(
        "Ask Nova is not included with your current plan."
      )
    ).toBeInTheDocument();
  });

  it("8. shows the safe backend rate-limit message", async () => {
    const user = userEvent.setup();
    api.post.mockRejectedValue({
      response: {
        status: 429,
        data: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "AI request limit exceeded. Try again later.",
        },
      },
    });
    renderDialog();

    await user.type(
      screen.getByLabelText("Ask about this workspace"),
      "What happened?"
    );
    await user.click(
      screen.getByRole("button", { name: /^Ask Nova$/i })
    );

    expect(
      await screen.findByText(
        "AI request limit exceeded. Try again later."
      )
    ).toBeInTheDocument();
  });

  it("9. handles generic and network failures safely", async () => {
    const user = userEvent.setup();
    api.post.mockRejectedValue(new Error("Network failed internally"));
    renderDialog();

    await user.type(
      screen.getByLabelText("Ask about this workspace"),
      "What happened?"
    );
    await user.click(
      screen.getByRole("button", { name: /^Ask Nova$/i })
    );

    expect(
      await screen.findByText(
        "Nova couldn't answer that right now. Please try again."
      )
    ).toBeInTheDocument();
    expect(screen.queryByText("Network failed internally"))
      .not.toBeInTheDocument();
  });

  it("10. prevents repeated submission while a request is pending", async () => {
    const user = userEvent.setup();
    let resolveRequest;
    api.post.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      })
    );
    renderDialog();

    await user.type(
      screen.getByLabelText("Ask about this workspace"),
      "What happened?"
    );
    const submit = screen.getByRole("button", { name: /^Ask Nova$/i });
    await user.click(submit);
    fireEvent.submit(submit.closest("form"));

    expect(api.post).toHaveBeenCalledTimes(1);

    resolveRequest({ data: buildAgentResponse() });
    await screen.findByText(buildAgentResponse().answer);
  });

  it("11. supports asking another question after success", async () => {
    const user = userEvent.setup();
    api.post
      .mockResolvedValueOnce({ data: buildAgentResponse() })
      .mockResolvedValueOnce({
        data: buildAgentResponse({ answer: "The second answer." }),
      });
    renderDialog();

    const input = screen.getByLabelText("Ask about this workspace");
    await user.type(input, "First question");
    await user.keyboard("{Enter}");
    await screen.findByText(buildAgentResponse().answer);

    await user.type(input, "Second question");
    await user.keyboard("{Enter}");

    expect(await screen.findByText("The second answer."))
      .toBeInTheDocument();
    expect(api.post).toHaveBeenNthCalledWith(
      2,
      `/workspaces/${WORKSPACE_ID}/ai/agent`,
      { question: "Second question" }
    );
  });

  it("12. never displays raw observations or hidden trace data", async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({
      data: {
        ...buildAgentResponse(),
        rawObservations: ["SECRET OBSERVATION"],
        systemPrompt: "SECRET SYSTEM PROMPT",
        reasoning: "SECRET REASONING",
      },
    });
    renderDialog();

    await user.type(
      screen.getByLabelText("Ask about this workspace"),
      "What happened?"
    );
    await user.click(
      screen.getByRole("button", { name: /^Ask Nova$/i })
    );

    await screen.findByText(buildAgentResponse().answer);
    expect(screen.queryByText("SECRET OBSERVATION"))
      .not.toBeInTheDocument();
    expect(screen.queryByText("SECRET SYSTEM PROMPT"))
      .not.toBeInTheDocument();
    expect(screen.queryByText("SECRET REASONING"))
      .not.toBeInTheDocument();
  });

  it("13. handles an expired session through the existing logout flow", async () => {
    const user = userEvent.setup();
    api.post.mockRejectedValue({
      response: { status: 401, data: {} },
    });
    renderDialog();

    await user.type(
      screen.getByLabelText("Ask about this workspace"),
      "What happened?"
    );
    await user.click(
      screen.getByRole("button", { name: /^Ask Nova$/i })
    );

    await waitFor(() => {
      expect(logout).toHaveBeenCalledTimes(1);
    });
    expect(
      screen.getByText("Your session expired. Please sign in again.")
    ).toBeInTheDocument();
  });

  it("14. renders an answer without a memory proposal normally", async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({ data: buildAgentResponse() });
    renderDialog();

    await user.type(
      screen.getByLabelText("Ask about this workspace"),
      "What did we decide?"
    );
    await user.keyboard("{Enter}");

    expect(await screen.findByText(buildAgentResponse().answer))
      .toBeInTheDocument();
    expect(screen.queryByText("Suggested workspace memory"))
      .not.toBeInTheDocument();
  });

  it("15. clearly renders a valid proposal as not yet saved", async () => {
    const user = userEvent.setup();
    const proposal = buildMemoryProposal();
    api.post.mockResolvedValue({
      data: buildAgentResponse({ memoryProposal: proposal }),
    });
    renderDialog();

    await user.type(
      screen.getByLabelText("Ask about this workspace"),
      "What did we decide?"
    );
    await user.keyboard("{Enter}");

    expect(await screen.findByText("Suggested workspace memory"))
      .toBeInTheDocument();
    expect(screen.getByText("Suggestion only — not saved yet."))
      .toBeInTheDocument();
    expect(screen.getByText(proposal.content)).toBeInTheDocument();
    expect(screen.getByText("decision")).toBeInTheDocument();
    expect(screen.getByText("Importance: high")).toBeInTheDocument();
    expect(screen.queryByText(SOURCE_MESSAGE_ID))
      .not.toBeInTheDocument();
  });

  it("16. Save posts only approved memory fields to the correct endpoint", async () => {
    const user = userEvent.setup();
    const proposal = buildMemoryProposal();
    api.post
      .mockResolvedValueOnce({
        data: buildAgentResponse({ memoryProposal: proposal }),
      })
      .mockResolvedValueOnce({ data: { memory: { id: "memory-1" } } });
    renderDialog();

    await user.type(
      screen.getByLabelText("Ask about this workspace"),
      "What did we decide?"
    );
    await user.keyboard("{Enter}");
    await user.click(
      await screen.findByRole("button", { name: "Save to Memory" })
    );

    expect(api.post).toHaveBeenNthCalledWith(
      2,
      `/workspaces/${WORKSPACE_ID}/ai/memories`,
      {
        type: "decision",
        content: "Production backend uses Railway.",
        importance: "high",
        sourceMessageIds: [SOURCE_MESSAGE_ID],
      }
    );
    expect(Object.keys(api.post.mock.calls[1][1]).sort()).toEqual([
      "content",
      "importance",
      "sourceMessageIds",
      "type",
    ]);
  });

  it("17. memory-save loading prevents duplicate requests", async () => {
    const user = userEvent.setup();
    let resolveSave;
    api.post
      .mockResolvedValueOnce({
        data: buildAgentResponse({
          memoryProposal: buildMemoryProposal(),
        }),
      })
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveSave = resolve;
        })
      );
    renderDialog();

    await user.type(
      screen.getByLabelText("Ask about this workspace"),
      "What did we decide?"
    );
    await user.keyboard("{Enter}");
    const saveButton = await screen.findByRole("button", {
      name: "Save to Memory",
    });
    await user.click(saveButton);
    fireEvent.click(
      screen.getByRole("button", { name: "Saving to Memory..." })
    );

    expect(
      screen.getByRole("button", { name: "Saving to Memory..." })
    ).toBeDisabled();
    expect(api.post).toHaveBeenCalledTimes(2);

    resolveSave({ data: { memory: { id: "memory-1" } } });
    expect(
      await screen.findByText("Saved to workspace memory.")
    ).toBeInTheDocument();
  });

  it("18. successful save removes the proposal and shows confirmation", async () => {
    const user = userEvent.setup();
    api.post
      .mockResolvedValueOnce({
        data: buildAgentResponse({
          memoryProposal: buildMemoryProposal(),
        }),
      })
      .mockResolvedValueOnce({ data: { memory: { id: "memory-1" } } });
    renderDialog();

    await user.type(
      screen.getByLabelText("Ask about this workspace"),
      "What did we decide?"
    );
    await user.keyboard("{Enter}");
    await user.click(
      await screen.findByRole("button", { name: "Save to Memory" })
    );

    expect(
      await screen.findByText("Saved to workspace memory.")
    ).toBeInTheDocument();
    expect(screen.queryByText("Suggested workspace memory"))
      .not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save to Memory" }))
      .not.toBeInTheDocument();
  });

  it("19. save failure keeps the proposal visible and allows retry", async () => {
    const user = userEvent.setup();
    api.post
      .mockResolvedValueOnce({
        data: buildAgentResponse({
          memoryProposal: buildMemoryProposal(),
        }),
      })
      .mockRejectedValueOnce(new Error("private network details"))
      .mockResolvedValueOnce({ data: { memory: { id: "memory-1" } } });
    renderDialog();

    await user.type(
      screen.getByLabelText("Ask about this workspace"),
      "What did we decide?"
    );
    await user.keyboard("{Enter}");
    await user.click(
      await screen.findByRole("button", { name: "Save to Memory" })
    );

    expect(
      await screen.findByText(
        "The memory couldn't be saved right now. Please try again."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("Suggested workspace memory"))
      .toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Save to Memory" })
    );
    expect(
      await screen.findByText("Saved to workspace memory.")
    ).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledTimes(3);
  });

  it("20. Dismiss removes the current proposal", async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({
      data: buildAgentResponse({
        memoryProposal: buildMemoryProposal(),
      }),
    });
    renderDialog();

    await user.type(
      screen.getByLabelText("Ask about this workspace"),
      "What did we decide?"
    );
    await user.keyboard("{Enter}");
    await user.click(
      await screen.findByRole("button", { name: "Dismiss" })
    );

    expect(screen.queryByText("Suggested workspace memory"))
      .not.toBeInTheDocument();
  });

  it("21. Dismiss performs no memory POST", async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({
      data: buildAgentResponse({
        memoryProposal: buildMemoryProposal(),
      }),
    });
    renderDialog();

    await user.type(
      screen.getByLabelText("Ask about this workspace"),
      "What did we decide?"
    );
    await user.keyboard("{Enter}");
    await user.click(
      await screen.findByRole("button", { name: "Dismiss" })
    );

    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenNthCalledWith(
      1,
      `/workspaces/${WORKSPACE_ID}/ai/agent`,
      { question: "What did we decide?" }
    );
  });

  it("22. memory proposal content is rendered as inert text", async () => {
    const user = userEvent.setup();
    const unsafeContent =
      '<img src="x" onerror="window.memoryExecuted=true">Railway';
    const { container } = renderDialog();
    api.post.mockResolvedValue({
      data: buildAgentResponse({
        memoryProposal: buildMemoryProposal({ content: unsafeContent }),
      }),
    });

    await user.type(
      screen.getByLabelText("Ask about this workspace"),
      "What did we decide?"
    );
    await user.keyboard("{Enter}");

    expect(await screen.findByText(unsafeContent)).toBeInTheDocument();
    expect(container.querySelector("[onerror], [onload]")).toBeNull();
    expect(window.memoryExecuted).toBeUndefined();
  });

  it("23. malformed proposal data is not rendered or saveable", async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({
      data: buildAgentResponse({
        memoryProposal: {
          ...buildMemoryProposal(),
          workspace: "another-workspace",
          sourceMessageIds: "not-an-array",
        },
      }),
    });
    renderDialog();

    await user.type(
      screen.getByLabelText("Ask about this workspace"),
      "What did we decide?"
    );
    await user.keyboard("{Enter}");
    await screen.findByText(buildAgentResponse().answer);

    expect(screen.queryByText("Suggested workspace memory"))
      .not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save to Memory" }))
      .not.toBeInTheDocument();
  });
});
