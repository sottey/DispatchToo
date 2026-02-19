import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "@/test/setup";

const redirectMock = vi.fn((target: string) => {
  throw new Error(`REDIRECT:${target}`);
});

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

const Home = (await import("@/app/page")).default;

const BASE_USER = {
  id: "user-1",
  name: "Test User",
  email: "test@example.com",
};

describe("Home page redirect", () => {
  beforeEach(() => {
    redirectMock.mockClear();
  });

  it("redirects unauthenticated users to /login", async () => {
    mockSession(null);

    await expect(Home()).rejects.toThrow("REDIRECT:/login");
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("redirects to route for each supported defaultStartNode", async () => {
    const cases: Array<{
      startNode: "dashboard" | "dispatch" | "inbox" | "tasks" | "notes" | "insights" | "projects";
      target: string;
    }> = [
      { startNode: "dashboard", target: "/dashboard" },
      { startNode: "dispatch", target: "/dispatch" },
      { startNode: "inbox", target: "/inbox" },
      { startNode: "tasks", target: "/tasks" },
      { startNode: "notes", target: "/notes" },
      { startNode: "insights", target: "/insights" },
      { startNode: "projects", target: "/projects" },
    ];

    for (const item of cases) {
      mockSession({ user: { ...BASE_USER, defaultStartNode: item.startNode } });
      await expect(Home()).rejects.toThrow(`REDIRECT:${item.target}`);
    }
  });

  it("falls back to root route for unexpected defaultStartNode values", async () => {
    mockSession({ user: { ...BASE_USER, defaultStartNode: "unknown" as never } });

    await expect(Home()).rejects.toThrow("REDIRECT:/");
    expect(redirectMock).toHaveBeenCalledWith("/");
  });
});
