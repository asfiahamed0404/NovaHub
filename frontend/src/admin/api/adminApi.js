import api from "../../api/axios.js";

class AdminApiError extends Error {
  constructor(message, { status = 0, code = "" } = {}) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
    this.code = code;
  }
}

const STATUS_MESSAGES = {
  401: "Your NovaHub session has expired. Please sign in again.",
  403: "You do not have permission to use the NovaHub Admin Console.",
  404: "The requested admin resource could not be found.",
  429: "Too many requests were made. Please wait a moment and try again.",
};

function normalizeAdminError(error, fallbackMessage) {
  if (error instanceof AdminApiError) {
    return error;
  }

  if (error?.code === "ERR_CANCELED") {
    return new AdminApiError("Request cancelled.", {
      code: "ERR_CANCELED",
    });
  }

  const status = Number(error?.response?.status) || 0;
  const responseData = error?.response?.data;
  const responseMessage =
    typeof responseData?.message === "string"
      ? responseData.message.trim()
      : "";

  let message = STATUS_MESSAGES[status] || fallbackMessage;

  if ((status === 400 || status === 409) && responseMessage) {
    message = responseMessage;
  } else if (!error?.response) {
    message =
      "NovaHub could not reach the admin service. Check your connection and try again.";
  }

  return new AdminApiError(message, {
    status,
    code:
      typeof responseData?.code === "string"
        ? responseData.code
        : "",
  });
}

async function requestAdmin(makeRequest, fallbackMessage) {
  try {
    const response = await makeRequest();
    return response.data;
  } catch (error) {
    throw normalizeAdminError(error, fallbackMessage);
  }
}

function compactParams(params) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => {
      return value !== "" && value !== null && value !== undefined;
    })
  );
}

function encodeId(value) {
  return encodeURIComponent(String(value));
}

const adminApi = {
  getDashboard({ signal } = {}) {
    return requestAdmin(
      () => api.get("/admin/dashboard", { signal }),
      "Failed to load the admin overview. Please try again."
    );
  },

  listUsers(params = {}, { signal } = {}) {
    return requestAdmin(
      () =>
        api.get("/admin/users", {
          params: compactParams(params),
          signal,
        }),
      "Failed to load users. Please try again."
    );
  },

  getUser(userId, { signal } = {}) {
    return requestAdmin(
      () =>
        api.get(`/admin/users/${encodeId(userId)}`, {
          signal,
        }),
      "Failed to load this user. Please try again."
    );
  },

  updateUser(userId, updates) {
    return requestAdmin(
      () =>
        api.patch(
          `/admin/users/${encodeId(userId)}`,
          updates
        ),
      "Failed to update this user. Please try again."
    );
  },

  listWorkspaces(params = {}, { signal } = {}) {
    return requestAdmin(
      () =>
        api.get("/admin/workspaces", {
          params: compactParams(params),
          signal,
        }),
      "Failed to load workspaces. Please try again."
    );
  },

  getWorkspace(workspaceId, { signal } = {}) {
    return requestAdmin(
      () =>
        api.get(`/admin/workspaces/${encodeId(workspaceId)}`, {
          signal,
        }),
      "Failed to load this workspace. Please try again."
    );
  },

  listAiUsage(params = {}, { signal } = {}) {
    return requestAdmin(
      () =>
        api.get("/admin/ai-usage", {
          params: compactParams(params),
          signal,
        }),
      "Failed to load AI usage. Please try again."
    );
  },

  listMemories(params = {}, { signal } = {}) {
    return requestAdmin(
      () =>
        api.get("/admin/memories", {
          params: compactParams(params),
          signal,
        }),
      "Failed to load workspace memories. Please try again."
    );
  },

  deleteMemory(memoryId) {
    return requestAdmin(
      () =>
        api.delete(`/admin/memories/${encodeId(memoryId)}`),
      "Failed to delete this workspace memory. Please try again."
    );
  },
};

function isAdminRequestCancelled(error) {
  return error?.code === "ERR_CANCELED";
}

function isAdminSessionExpired(error) {
  return error?.status === 401;
}

export {
  AdminApiError,
  adminApi,
  isAdminRequestCancelled,
  isAdminSessionExpired,
  normalizeAdminError,
};
