import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/axios.js", () => ({
  default: {
    get: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import api from "../../api/axios.js";
import {
  AdminApiError,
  adminApi,
  isAdminRequestCancelled,
  isAdminSessionExpired,
  normalizeAdminError,
} from "../api/adminApi.js";

const SIGNAL = new AbortController().signal;

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue({ data: { ok: true } });
  api.patch.mockResolvedValue({ data: { ok: true } });
  api.delete.mockResolvedValue({ data: { ok: true } });
});

describe("adminApi request contract", () => {
  it("uses the dashboard endpoint and returns only response data", async () => {
    api.get.mockResolvedValueOnce({ data: { stats: { users: 4 } } });

    await expect(adminApi.getDashboard({ signal: SIGNAL })).resolves.toEqual({
      stats: { users: 4 },
    });
    expect(api.get).toHaveBeenCalledWith("/admin/dashboard", {
      signal: SIGNAL,
    });
  });

  it("compacts user-list params while preserving meaningful zero and false values", async () => {
    await adminApi.listUsers(
      {
        page: 0,
        limit: 20,
        search: "",
        role: null,
        plan: undefined,
        includeLegacy: false,
      },
      { signal: SIGNAL }
    );

    expect(api.get).toHaveBeenCalledWith("/admin/users", {
      params: {
        page: 0,
        limit: 20,
        includeLegacy: false,
      },
      signal: SIGNAL,
    });
  });

  it("encodes user IDs and sends only the supplied PATCH allowlist payload", async () => {
    const updates = { role: "admin", plan: "premium" };

    await adminApi.getUser("user/id ?#", { signal: SIGNAL });
    await adminApi.updateUser("user/id ?#", updates);

    expect(api.get).toHaveBeenCalledWith(
      "/admin/users/user%2Fid%20%3F%23",
      { signal: SIGNAL }
    );
    expect(api.patch).toHaveBeenCalledWith(
      "/admin/users/user%2Fid%20%3F%23",
      updates
    );
  });

  it("uses the workspace list and encoded detail endpoints", async () => {
    await adminApi.listWorkspaces(
      { page: 2, limit: 20, search: "Apollo", ignored: "" },
      { signal: SIGNAL }
    );
    await adminApi.getWorkspace("workspace/a b", { signal: SIGNAL });

    expect(api.get).toHaveBeenNthCalledWith(1, "/admin/workspaces", {
      params: { page: 2, limit: 20, search: "Apollo" },
      signal: SIGNAL,
    });
    expect(api.get).toHaveBeenNthCalledWith(
      2,
      "/admin/workspaces/workspace%2Fa%20b",
      { signal: SIGNAL }
    );
  });

  it("uses the AI usage endpoint with compacted params and cancellation signal", async () => {
    await adminApi.listAiUsage(
      { page: 1, limit: 20, search: "Nina", plan: "", nullable: null },
      { signal: SIGNAL }
    );

    expect(api.get).toHaveBeenCalledWith("/admin/ai-usage", {
      params: { page: 1, limit: 20, search: "Nina" },
      signal: SIGNAL,
    });
  });

  it("uses the memories endpoint and safely encodes DELETE IDs", async () => {
    await adminApi.listMemories(
      {
        page: 3,
        limit: 20,
        search: "decision",
        type: "decision",
        importance: "high",
        workspaceId: "workspace-1",
        empty: "",
      },
      { signal: SIGNAL }
    );
    await adminApi.deleteMemory("memory/id ?#");

    expect(api.get).toHaveBeenCalledWith("/admin/memories", {
      params: {
        page: 3,
        limit: 20,
        search: "decision",
        type: "decision",
        importance: "high",
        workspaceId: "workspace-1",
      },
      signal: SIGNAL,
    });
    expect(api.delete).toHaveBeenCalledWith(
      "/admin/memories/memory%2Fid%20%3F%23"
    );
  });
});

describe("adminApi error normalization", () => {
  it.each([
    [400, "INVALID_FILTER", "Use a supported filter."],
    [409, "LAST_ADMIN_REQUIRED", "The final admin cannot be demoted."],
  ])(
    "preserves a safe backend message for HTTP %i",
    async (status, code, message) => {
      api.get.mockRejectedValueOnce({
        response: { status, data: { code, message } },
      });

      await expect(adminApi.getDashboard()).rejects.toMatchObject({
        name: "AdminApiError",
        status,
        code,
        message,
      });
    }
  );

  it.each([
    [401, "Your NovaHub session has expired. Please sign in again."],
    [403, "You do not have permission to use the NovaHub Admin Console."],
    [404, "The requested admin resource could not be found."],
    [429, "Too many requests were made. Please wait a moment and try again."],
  ])(
    "replaces an HTTP %i server message with the safe status message",
    async (status, message) => {
      api.get.mockRejectedValueOnce({
        response: {
          status,
          data: {
            code: `HTTP_${status}`,
            message: "Raw backend detail that must not reach the UI.",
          },
        },
      });

      await expect(adminApi.getDashboard()).rejects.toMatchObject({
        name: "AdminApiError",
        status,
        code: `HTTP_${status}`,
        message,
      });
    }
  );

  it("uses the operation fallback for an HTTP 500 without exposing server detail", async () => {
    api.get.mockRejectedValueOnce({
      response: {
        status: 500,
        data: {
          code: "INTERNAL_FAILURE",
          message: "Database host and stack trace",
        },
      },
    });

    await expect(adminApi.getDashboard()).rejects.toMatchObject({
      status: 500,
      code: "INTERNAL_FAILURE",
      message: "Failed to load the admin overview. Please try again.",
    });
  });

  it("normalizes a network failure without exposing the transport error", async () => {
    api.get.mockRejectedValueOnce(new Error("getaddrinfo ENOTFOUND internal-db"));

    await expect(adminApi.getDashboard()).rejects.toMatchObject({
      status: 0,
      message:
        "NovaHub could not reach the admin service. Check your connection and try again.",
    });
  });

  it("normalizes cancellation and exposes cancellation/session predicates", async () => {
    api.get.mockRejectedValueOnce({ code: "ERR_CANCELED" });

    const request = adminApi.getDashboard();
    await expect(request).rejects.toMatchObject({
      status: 0,
      code: "ERR_CANCELED",
      message: "Request cancelled.",
    });

    await request.catch((error) => {
      expect(error).toBeInstanceOf(AdminApiError);
      expect(isAdminRequestCancelled(error)).toBe(true);
      expect(isAdminSessionExpired(error)).toBe(false);
    });

    expect(isAdminSessionExpired(new AdminApiError("Expired", { status: 401 }))).toBe(true);
    expect(isAdminRequestCancelled(new AdminApiError("Other"))).toBe(false);
  });

  it("does not wrap an existing AdminApiError a second time", () => {
    const original = new AdminApiError("Already safe", {
      status: 409,
      code: "SAFE_ERROR",
    });

    expect(normalizeAdminError(original, "Fallback")).toBe(original);
  });
});
