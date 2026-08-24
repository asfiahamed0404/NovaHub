import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

vi.mock("../../context/AuthContext.jsx", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../components/AdminLayout.jsx", async () => {
  const { Outlet } = await vi.importActual("react-router");

  return {
    default: function MockAdminLayout() {
      return (
        <main>
          <p>Admin route shell</p>
          <Outlet />
        </main>
      );
    },
  };
});

vi.mock("../pages/AdminOverviewPage.jsx", () => ({
  default: () => <h1>Admin overview route</h1>,
}));
vi.mock("../pages/AdminUsersPage.jsx", () => ({
  default: () => <h1>Admin users route</h1>,
}));
vi.mock("../pages/AdminWorkspacesPage.jsx", () => ({
  default: () => <h1>Admin workspaces route</h1>,
}));
vi.mock("../pages/AdminAiUsagePage.jsx", () => ({
  default: () => <h1>Admin AI usage route</h1>,
}));
vi.mock("../pages/AdminMemoriesPage.jsx", () => ({
  default: () => <h1>Admin memories route</h1>,
}));

import { useAuth } from "../../context/AuthContext.jsx";
import App from "../../App.jsx";

const ROUTE_CASES = [
  ["/admin", "Admin overview route"],
  ["/admin/users", "Admin users route"],
  ["/admin/workspaces", "Admin workspaces route"],
  ["/admin/ai-usage", "Admin AI usage route"],
  ["/admin/memories", "Admin memories route"],
];

beforeEach(() => {
  useAuth.mockReturnValue({
    user: {
      id: "admin-route-user",
      name: "Route Admin",
      email: "route-admin@novahub.test",
      role: "admin",
      plan: "free",
    },
    setUser: vi.fn(),
    isLoading: false,
  });
});

describe("App admin route composition", () => {
  it.each(ROUTE_CASES)("resolves %s", (path, pageLabel) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText("Admin route shell")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: pageLabel })
    ).toBeInTheDocument();
  });
});
