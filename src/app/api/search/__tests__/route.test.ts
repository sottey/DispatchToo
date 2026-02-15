import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockSession } from "@/test/setup";
import { createTestDb } from "@/test/db";
import { users, tasks, notes, dispatches, projects } from "@/db/schema";

let testDb: ReturnType<typeof createTestDb>;

vi.mock("@/db", () => ({
  get db() {
    return testDb.db;
  },
}));

const { GET } = await import("@/app/api/search/route");

const TEST_USER = { id: "user-1", name: "Test User", email: "test@test.com" };
const OTHER_USER = { id: "user-2", name: "Other User", email: "other@test.com" };

describe("Search API", () => {
  beforeEach(() => {
    testDb = createTestDb();
    testDb.db.insert(users).values(TEST_USER).run();
    testDb.db.insert(users).values(OTHER_USER).run();
    mockSession({ user: TEST_USER });

    const now = new Date().toISOString();

    // Seed tasks
    testDb.db
      .insert(tasks)
      .values([
        { id: "t1", userId: TEST_USER.id, title: "Build dashboard", description: "React components", status: "open", priority: "high", createdAt: now, updatedAt: now },
        { id: "t2", userId: TEST_USER.id, title: "Fix login", description: "OAuth redirect bug", status: "done", priority: "medium", createdAt: now, updatedAt: now },
        { id: "t3", userId: OTHER_USER.id, title: "Build dashboard too", description: "Secret stuff", status: "open", priority: "low", createdAt: now, updatedAt: now },
      ])
      .run();

    // Seed notes
    testDb.db
      .insert(notes)
      .values([
        { id: "n1", userId: TEST_USER.id, title: "Meeting notes", content: "Discussed the dashboard redesign", createdAt: now, updatedAt: now },
        { id: "n2", userId: TEST_USER.id, title: "Quick ideas", content: "Add search feature", createdAt: now, updatedAt: now },
        { id: "n3", userId: OTHER_USER.id, title: "Meeting notes private", content: "Secret meeting", createdAt: now, updatedAt: now },
      ])
      .run();

    // Seed dispatches
    testDb.db
      .insert(dispatches)
      .values([
        { id: "d1", userId: TEST_USER.id, date: "2025-01-01", summary: "Worked on dashboard features", createdAt: now, updatedAt: now },
        { id: "d2", userId: OTHER_USER.id, date: "2025-01-01", summary: "Dashboard private work", createdAt: now, updatedAt: now },
      ])
      .run();

    // Seed projects
    testDb.db
      .insert(projects)
      .values([
        { id: "p1", userId: TEST_USER.id, name: "Dashboard Revamp", description: "Polish and redesign", status: "active", color: "blue", createdAt: now, updatedAt: now },
        { id: "p2", userId: OTHER_USER.id, name: "Dashboard Secret", description: "Private project", status: "active", color: "purple", createdAt: now, updatedAt: now },
      ])
      .run();
  });

  it("returns 401 when unauthenticated", async () => {
    mockSession(null);
    const res = await GET(new Request("http://localhost/api/search?q=test"), {});
    expect(res.status).toBe(401);
  });

  it("returns 400 when q param is missing", async () => {
    const res = await GET(new Request("http://localhost/api/search"), {});
    expect(res.status).toBe(400);
  });

  it("returns 400 when q is empty", async () => {
    const res = await GET(new Request("http://localhost/api/search?q="), {});
    expect(res.status).toBe(400);
  });

  it("returns 400 when q is too long", async () => {
    const longQuery = "a".repeat(201);
    const res = await GET(new Request(`http://localhost/api/search?q=${longQuery}`), {});
    expect(res.status).toBe(400);
  });

  it("matches tasks by title", async () => {
    const res = await GET(new Request("http://localhost/api/search?q=dashboard"), {});
    const data = await res.json();
    expect(data.tasks).toHaveLength(1);
    expect(data.tasks[0].title).toBe("Build dashboard");
  });

  it("matches tasks by description", async () => {
    const res = await GET(new Request("http://localhost/api/search?q=OAuth"), {});
    const data = await res.json();
    expect(data.tasks).toHaveLength(1);
    expect(data.tasks[0].title).toBe("Fix login");
  });

  it("matches notes by title", async () => {
    const res = await GET(new Request("http://localhost/api/search?q=meeting"), {});
    const data = await res.json();
    expect(data.notes).toHaveLength(1);
    expect(data.notes[0].title).toBe("Meeting notes");
  });

  it("matches notes by content", async () => {
    const res = await GET(new Request("http://localhost/api/search?q=search+feature"), {});
    const data = await res.json();
    expect(data.notes).toHaveLength(1);
    expect(data.notes[0].title).toBe("Quick ideas");
  });

  it("matches dispatches by summary", async () => {
    const res = await GET(new Request("http://localhost/api/search?q=dashboard+features"), {});
    const data = await res.json();
    expect(data.dispatches).toHaveLength(1);
    expect(data.dispatches[0].id).toBe("d1");
  });

  it("matches projects by name", async () => {
    const res = await GET(new Request("http://localhost/api/search?q=revamp"), {});
    const data = await res.json();
    expect(data.projects).toHaveLength(1);
    expect(data.projects[0].id).toBe("p1");
  });

  it("matches projects by description", async () => {
    const res = await GET(new Request("http://localhost/api/search?q=redesign"), {});
    const data = await res.json();
    expect(data.projects).toHaveLength(1);
    expect(data.projects[0].id).toBe("p1");
  });

  it("search is case-insensitive", async () => {
    const res = await GET(new Request("http://localhost/api/search?q=DASHBOARD"), {});
    const data = await res.json();
    expect(data.tasks.length).toBeGreaterThan(0);
  });

  it("does not return other users' data", async () => {
    const res = await GET(new Request("http://localhost/api/search?q=dashboard"), {});
    const data = await res.json();
    // Should only find user-1's task, note, and dispatch
    expect(data.tasks.every((t: { userId: string }) => t.userId === TEST_USER.id)).toBe(true);
    expect(data.notes.every((n: { userId: string }) => n.userId === TEST_USER.id)).toBe(true);
    expect(data.dispatches.every((d: { userId: string }) => d.userId === TEST_USER.id)).toBe(true);
    expect(data.projects.every((p: { userId: string }) => p.userId === TEST_USER.id)).toBe(true);
  });

  it("returns results from all categories", async () => {
    const res = await GET(new Request("http://localhost/api/search?q=dashboard"), {});
    const data = await res.json();
    expect(data.tasks.length).toBeGreaterThan(0);
    expect(data.notes.length).toBeGreaterThan(0);
    expect(data.dispatches.length).toBeGreaterThan(0);
    expect(data.projects.length).toBeGreaterThan(0);
  });
});
