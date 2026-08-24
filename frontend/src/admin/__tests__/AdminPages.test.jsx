import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";

vi.mock("../../context/AuthContext.jsx", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../api/adminApi.js", () => ({
  adminApi: {
    getDashboard: vi.fn(),
    listUsers: vi.fn(),
    getUser: vi.fn(),
    updateUser: vi.fn(),
    listWorkspaces: vi.fn(),
    getWorkspace: vi.fn(),
    listAiUsage: vi.fn(),
    listMemories: vi.fn(),
    deleteMemory: vi.fn(),
  },
  isAdminRequestCancelled: (error) => error?.code === "ERR_CANCELED",
  isAdminSessionExpired: (error) => error?.status === 401,
}));

import { useAuth } from "../../context/AuthContext.jsx";
import { adminApi } from "../api/adminApi.js";
import AdminOverviewPage from "../pages/AdminOverviewPage.jsx";
import AdminUsersPage from "../pages/AdminUsersPage.jsx";
import AdminWorkspacesPage from "../pages/AdminWorkspacesPage.jsx";
import AdminAiUsagePage from "../pages/AdminAiUsagePage.jsx";
import AdminMemoriesPage from "../pages/AdminMemoriesPage.jsx";

const ADMIN_USER = {
  id: "user-admin",
  name: "Alice Admin",
  email: "alice@novahub.test",
  status: "Available",
  avatar: "",
  role: "admin",
  plan: "free",
  createdAt: "2026-08-01T10:00:00.000Z",
  updatedAt: "2026-08-20T10:00:00.000Z",
};

const WORKSPACE = {
  id: "workspace-1",
  name: "Apollo Workspace",
  description: "Launch planning and execution",
  createdBy: {
    id: ADMIN_USER.id,
    name: ADMIN_USER.name,
    email: ADMIN_USER.email,
    role: "admin",
    plan: "free",
  },
  memberCount: 2,
  messageCount: 17,
  memoryCount: 1,
  createdAt: "2026-08-02T10:00:00.000Z",
  updatedAt: "2026-08-21T10:00:00.000Z",
};

const HOSTILE_MEMORY_TEXT =
  '<img src=x onerror="window.__novahubAdminPwned=true">';

const MEMORY = {
  id: "memory-1",
  workspace: { id: WORKSPACE.id, name: WORKSPACE.name },
  type: "decision",
  content: HOSTILE_MEMORY_TEXT,
  importance: "high",
  createdBy: {
    id: ADMIN_USER.id,
    name: ADMIN_USER.name,
    email: ADMIN_USER.email,
  },
  sourceMessageIdsCount: 2,
  createdAt: "2026-08-18T10:00:00.000Z",
  updatedAt: "2026-08-18T10:00:00.000Z",
};

const PAGINATION = {
  page: 1,
  limit: 20,
  total: 1,
  pages: 1,
};

const DASHBOARD = {
  stats: {
    users: 42,
    workspaces: 9,
    messages: 1234,
    memories: 7,
  },
  usersByPlan: { free: 35, premium: 7 },
  usersByRole: { user: 40, admin: 2 },
  recentUsers: [ADMIN_USER],
  recentWorkspaces: [WORKSPACE],
  recentMemories: [MEMORY],
};

const USER_DETAILS = {
  user: {
    ...ADMIN_USER,
    aiEntitlement: {
      enabled: true,
      requestsPerWindow: 5,
      windowMinutes: 60,
    },
  },
  workspaceCount: 1,
  workspaces: [
    {
      id: WORKSPACE.id,
      name: WORKSPACE.name,
      createdAt: WORKSPACE.createdAt,
    },
  ],
  aiUsage: null,
};

const WORKSPACE_DETAILS = {
  workspace: WORKSPACE,
  members: [
    ADMIN_USER,
    {
      ...ADMIN_USER,
      id: "user-member",
      name: "Nina Member",
      email: "nina@novahub.test",
      role: "user",
      plan: "premium",
    },
  ],
  membersTruncated: false,
  recentMessages: [
    {
      id: "message-1",
      sender: {
        id: "user-member",
        name: "Nina Member",
        email: "nina@novahub.test",
      },
      messageType: "text",
      createdAt: "2026-08-21T09:00:00.000Z",
    },
  ],
  recentMemories: [MEMORY],
};

const AI_USAGE = {
  user: {
    id: "user-member",
    name: "Nina Member",
    email: "nina@novahub.test",
    role: "user",
    plan: "free",
  },
  plan: "free",
  requestCount: 4,
  limit: 5,
  windowMinutes: 60,
  windowStartedAt: "2026-08-24T08:00:00.000Z",
  resetAt: "2026-08-24T09:00:00.000Z",
  isRateLimited: false,
  quotaScope: "Shared per-user AI quota",
};

const logout = vi.fn();
const setUser = vi.fn();
const refreshUser = vi.fn();

function renderPage(page) {
  return render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route path="/admin" element={page} />
        <Route
          path="/dashboard"
          element={<p>NovaHub dashboard route</p>}
        />
      </Routes>
    </MemoryRouter>
  );
}

function resetApiMocks() {
  for (const request of Object.values(adminApi)) {
    request.mockReset();
  }

  adminApi.getDashboard.mockResolvedValue(DASHBOARD);
  adminApi.listUsers.mockResolvedValue({
    items: [ADMIN_USER],
    pagination: PAGINATION,
  });
  adminApi.getUser.mockResolvedValue(USER_DETAILS);
  adminApi.updateUser.mockResolvedValue({
    message: "User updated safely.",
    user: ADMIN_USER,
  });
  adminApi.listWorkspaces.mockResolvedValue({
    items: [WORKSPACE],
    pagination: PAGINATION,
  });
  adminApi.getWorkspace.mockResolvedValue(WORKSPACE_DETAILS);
  adminApi.listAiUsage.mockResolvedValue({
    items: [AI_USAGE],
    pagination: PAGINATION,
  });
  adminApi.listMemories.mockResolvedValue({
    items: [MEMORY],
    pagination: PAGINATION,
  });
  adminApi.deleteMemory.mockResolvedValue({
    message: "Memory deleted safely.",
    deletedMemoryId: MEMORY.id,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  resetApiMocks();
  useAuth.mockReturnValue({
    user: ADMIN_USER,
    setUser,
    logout,
    refreshUser,
    isLoading: false,
  });
  window.__novahubAdminPwned = false;
});

afterEach(() => {
  document.body.style.overflow = "";
  delete window.__novahubAdminPwned;
});

describe("admin overview", () => {
  it("renders dashboard KPI and recent platform data", async () => {
    renderPage(<AdminOverviewPage />);

    expect(await screen.findByText("Total Users")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("1,234")).toBeInTheDocument();
    expect(screen.getByText("Users by Plan")).toBeInTheDocument();
    expect(screen.getByText("Alice Admin")).toBeInTheDocument();
    expect(screen.getAllByText("Apollo Workspace").length).toBeGreaterThan(0);
    expect(screen.getByText(HOSTILE_MEMORY_TEXT)).toBeInTheDocument();
  });

  it("renders a loading state while the dashboard request is pending", () => {
    adminApi.getDashboard.mockReset().mockReturnValue(new Promise(() => {}));

    renderPage(<AdminOverviewPage />);

    expect(screen.getByText("Loading admin overview...")).toBeInTheDocument();
  });

  it("renders a safe dashboard API error state", async () => {
    adminApi.getDashboard
      .mockReset()
      .mockRejectedValue(new Error("Admin overview is unavailable."));

    renderPage(<AdminOverviewPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Admin overview is unavailable."
    );
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("refreshes the signed-in identity and exits admin UI after a 403", async () => {
    const accessError = Object.assign(
      new Error("Admin access was revoked."),
      { status: 403 }
    );
    adminApi.getDashboard.mockReset().mockRejectedValue(accessError);
    refreshUser.mockResolvedValue({
      ...ADMIN_USER,
      role: "user",
    });

    renderPage(<AdminOverviewPage />);

    await waitFor(() => {
      expect(refreshUser).toHaveBeenCalledTimes(1);
    });
    expect(
      await screen.findByText("NovaHub dashboard route")
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("admin users", () => {
  it("renders users and sends trimmed search, role, and plan filters", async () => {
    const user = userEvent.setup();
    renderPage(<AdminUsersPage />);

    expect(await screen.findByText("alice@novahub.test")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Search users"), "  alice  ");
    await user.click(screen.getByRole("button", { name: "Search" }));
    await user.selectOptions(screen.getByLabelText("Role"), "admin");
    await user.selectOptions(screen.getByLabelText("Plan"), "premium");

    await waitFor(() => {
      expect(adminApi.listUsers).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
          limit: 20,
          search: "alice",
          role: "admin",
          plan: "premium",
        }),
        expect.any(Object)
      );
    });
  });

  it("reviews and confirms an intentional role and plan update", async () => {
    const user = userEvent.setup();
    const updatedUser = {
      ...ADMIN_USER,
      role: "user",
      plan: "premium",
    };
    adminApi.updateUser.mockResolvedValue({
      message: "User updated safely.",
      user: updatedUser,
    });

    renderPage(<AdminUsersPage />);
    await user.click(await screen.findByRole("button", { name: "View Alice Admin" }));

    const dialog = await screen.findByRole("dialog", { name: "Alice Admin" });
    await user.selectOptions(within(dialog).getByLabelText("Platform role"), "user");
    await user.selectOptions(within(dialog).getByLabelText("Plan"), "premium");
    await user.click(within(dialog).getByRole("button", { name: "Review changes" }));
    await user.click(within(dialog).getByRole("button", { name: "Confirm update" }));

    await waitFor(() => {
      expect(adminApi.updateUser).toHaveBeenCalledWith(ADMIN_USER.id, {
        role: "user",
        plan: "premium",
      });
    });
    expect(setUser).toHaveBeenCalledWith(expect.any(Function));
    expect(await within(dialog).findByText("User updated safely.")).toBeInTheDocument();
  });

  it("keeps the user editor open and reports an update failure", async () => {
    const user = userEvent.setup();
    adminApi.updateUser
      .mockReset()
      .mockRejectedValue(new Error("The account update was rejected."));

    renderPage(<AdminUsersPage />);
    await user.click(await screen.findByRole("button", { name: "View Alice Admin" }));

    const dialog = await screen.findByRole("dialog", { name: "Alice Admin" });
    await user.selectOptions(within(dialog).getByLabelText("Plan"), "premium");
    await user.click(within(dialog).getByRole("button", { name: "Review changes" }));
    await user.click(within(dialog).getByRole("button", { name: "Confirm update" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "The account update was rejected."
    );
    expect(dialog).toBeInTheDocument();
  });

  it("refetches the last valid page when totals shrink", async () => {
    const user = userEvent.setup();
    adminApi.listUsers
      .mockReset()
      .mockResolvedValueOnce({
        items: [ADMIN_USER],
        pagination: { ...PAGINATION, total: 21, pages: 2 },
      })
      .mockResolvedValueOnce({
        items: [],
        pagination: { ...PAGINATION, page: 2 },
      })
      .mockResolvedValueOnce({
        items: [ADMIN_USER],
        pagination: PAGINATION,
      });

    renderPage(<AdminUsersPage />);
    await user.click(
      await screen.findByRole("button", { name: "Next" })
    );

    await waitFor(() => {
      expect(adminApi.listUsers).toHaveBeenCalledTimes(3);
    });
    expect(adminApi.listUsers.mock.calls[1][0].page).toBe(2);
    expect(adminApi.listUsers.mock.calls[2][0].page).toBe(1);
    expect(screen.getByText("Page 1 of 1")).toBeInTheDocument();
  });
});

describe("admin workspaces", () => {
  it("renders workspace counts and bounded workspace details", async () => {
    const user = userEvent.setup();
    renderPage(<AdminWorkspacesPage />);

    expect(await screen.findByText("Launch planning and execution")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "View Apollo Workspace" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Apollo Workspace",
    });
    expect(within(dialog).getAllByText("Nina Member").length).toBeGreaterThan(0);
    expect(within(dialog).getByText("Recent message metadata")).toBeInTheDocument();
    expect(within(dialog).getByText(HOSTILE_MEMORY_TEXT)).toBeInTheDocument();
    expect(adminApi.getWorkspace).toHaveBeenCalledWith(
      WORKSPACE.id,
      expect.any(Object)
    );
  });
});

describe("admin AI usage", () => {
  it("renders truthful shared-quota data and applies the plan filter", async () => {
    const user = userEvent.setup();
    renderPage(<AdminAiUsagePage />);

    expect(await screen.findByText("Nina Member")).toBeInTheDocument();
    expect(screen.getByText(/4\s*\/\s*5/)).toBeInTheDocument();
    expect(screen.getByText("Near Limit")).toBeInTheDocument();
    expect(screen.getByText(/Catch Me Up and Ask Nova/)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Plan"), "premium");
    await waitFor(() => {
      expect(adminApi.listAiUsage).toHaveBeenCalledWith(
        expect.objectContaining({ plan: "premium", page: 1, limit: 20 }),
        expect.any(Object)
      );
    });
  });
});

describe("admin workspace memories", () => {
  it("renders content as inert text, confirms deletion, and removes the row", async () => {
    const user = userEvent.setup();
    renderPage(<AdminMemoriesPage />);

    expect(await screen.findByText(HOSTILE_MEMORY_TEXT)).toBeInTheDocument();
    expect(screen.getByText(WORKSPACE.id)).toBeInTheDocument();
    expect(document.querySelector('img[src="x"]')).not.toBeInTheDocument();
    expect(window.__novahubAdminPwned).toBe(false);

    await user.click(screen.getByRole("button", { name: "Delete Decision memory" }));
    const dialog = await screen.findByRole("dialog", { name: "Decision memory" });
    expect(within(dialog).getByRole("group", { name: "Confirm memory deletion" })).toBeInTheDocument();
    expect(adminApi.deleteMemory).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Confirm delete" }));

    await waitFor(() => {
      expect(adminApi.deleteMemory).toHaveBeenCalledWith(MEMORY.id);
    });
    expect(await screen.findByText("Memory deleted safely.")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText(HOSTILE_MEMORY_TEXT)).not.toBeInTheDocument();
    });
  });

  it("reports a delete failure without removing the memory", async () => {
    const user = userEvent.setup();
    adminApi.deleteMemory
      .mockReset()
      .mockRejectedValue(new Error("The memory could not be deleted."));

    renderPage(<AdminMemoriesPage />);
    await screen.findByText(HOSTILE_MEMORY_TEXT);
    await user.click(screen.getByRole("button", { name: "Delete Decision memory" }));

    const dialog = await screen.findByRole("dialog", { name: "Decision memory" });
    await user.click(within(dialog).getByRole("button", { name: "Confirm delete" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "The memory could not be deleted."
    );
    expect(screen.getAllByText(HOSTILE_MEMORY_TEXT).length).toBeGreaterThan(0);
  });
});
