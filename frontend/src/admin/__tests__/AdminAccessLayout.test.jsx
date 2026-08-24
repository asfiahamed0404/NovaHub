import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";

vi.mock("../../context/AuthContext.jsx", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../../components/ThemeSelector.jsx", () => ({
  default: () => <span>Theme controls</span>,
}));

import { useAuth } from "../../context/AuthContext.jsx";
import AdminRoute from "../AdminRoute.jsx";
import AdminLayout from "../components/AdminLayout.jsx";

const ADMIN_USER = {
  id: "admin-1",
  name: "Ada Admin",
  email: "ada@novahub.test",
  role: "admin",
  plan: "premium",
};

const NORMAL_USER = {
  ...ADMIN_USER,
  id: "user-1",
  name: "Nora Member",
  role: "user",
  plan: "free",
};

const logout = vi.fn();
const setUser = vi.fn();

function mockAuth(user) {
  useAuth.mockReturnValue({
    user,
    setUser,
    logout,
    isLoading: false,
  });
}

function renderGuardedRoute() {
  return render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <p>Protected admin content</p>
            </AdminRoute>
          }
        />
        <Route path="/dashboard" element={<p>Member dashboard</p>} />
        <Route path="/login" element={<p>Sign in screen</p>} />
      </Routes>
    </MemoryRouter>
  );
}

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<p>Overview page content</p>} />
        </Route>
        <Route path="/dashboard" element={<p>Normal NovaHub area</p>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth(ADMIN_USER);
});

describe("admin route access", () => {
  it("redirects an authenticated non-admin away from the admin panel", () => {
    mockAuth(NORMAL_USER);

    renderGuardedRoute();

    expect(screen.getByText("Member dashboard")).toBeInTheDocument();
    expect(screen.queryByText("Protected admin content")).not.toBeInTheDocument();
  });

  it("allows a platform admin to enter the admin panel", () => {
    renderGuardedRoute();

    expect(screen.getByText("Protected admin content")).toBeInTheDocument();
  });
});

describe("admin layout", () => {
  it("renders the admin identity and all section navigation", () => {
    renderLayout();

    expect(screen.getByText("Admin Console")).toBeInTheDocument();
    expect(screen.getByText("Ada Admin")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Admin sections" })).toBeInTheDocument();

    for (const name of ["Overview", "Users", "Workspaces", "AI Usage", "Memories"]) {
      expect(screen.getByRole("link", { name })).toBeInTheDocument();
    }

    expect(screen.getByText("Overview page content")).toBeInTheDocument();
  });

  it("navigates back to NovaHub and keeps logout wired to auth", async () => {
    const user = userEvent.setup();
    const { unmount } = renderLayout();

    const backLink = screen.getByRole("link", { name: "Back to NovaHub" });
    expect(backLink).toHaveAttribute("href", "/dashboard");
    await user.click(backLink);
    expect(screen.getByText("Normal NovaHub area")).toBeInTheDocument();

    unmount();
    renderLayout();
    await user.click(screen.getByRole("button", { name: "Log out" }));
    expect(logout).toHaveBeenCalledTimes(1);
  });
});
