import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb } from "@/test/db";
import { mockSession } from "@/test/setup";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

let testDb: ReturnType<typeof createTestDb>;

vi.mock("@/db", () => ({
  get db() {
    return testDb.db;
  },
}));

const { GET, PUT } = await import("@/app/api/me/route");

const TEST_USER = {
  id: "user-1",
  name: "Test User",
  email: "test@example.com",
  role: "admin" as const,
  showAdminQuickAccess: true,
  assistantEnabled: true,
  tasksTodayFocusDefault: false,
  showDispatchHelp: true,
  notesMetadataCollapsedDefault: false,
  defaultStartNode: "dashboard" as const,
};

function jsonReq(url: string, body: unknown) {
  return new Request(url, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Me API", () => {
  beforeEach(() => {
    testDb = createTestDb();
    testDb.db.insert(users).values(TEST_USER).run();
    mockSession({
      user: {
        id: TEST_USER.id,
        name: TEST_USER.name,
        email: TEST_USER.email,
        role: TEST_USER.role,
      },
    });
  });

  it("GET returns current user session", async () => {
    const res = await GET(new Request("http://localhost/api/me"), {});
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.user.id).toBe(TEST_USER.id);
  });

  it("PUT updates showAdminQuickAccess to false", async () => {
    const res = await PUT(
      jsonReq("http://localhost/api/me", { showAdminQuickAccess: false }),
      {},
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      showAdminQuickAccess: false,
      assistantEnabled: true,
      tasksTodayFocusDefault: false,
      showDispatchHelp: true,
      notesMetadataCollapsedDefault: false,
      defaultStartNode: "dashboard",
    });

    const [updated] = testDb.db
      .select({ showAdminQuickAccess: users.showAdminQuickAccess })
      .from(users)
      .where(eq(users.id, TEST_USER.id))
      .all();
    expect(updated.showAdminQuickAccess).toBe(false);
  });

  it("PUT updates assistantEnabled to false", async () => {
    const res = await PUT(
      jsonReq("http://localhost/api/me", { assistantEnabled: false }),
      {},
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      showAdminQuickAccess: true,
      assistantEnabled: false,
      tasksTodayFocusDefault: false,
      showDispatchHelp: true,
      notesMetadataCollapsedDefault: false,
      defaultStartNode: "dashboard",
    });

    const [updated] = testDb.db
      .select({ assistantEnabled: users.assistantEnabled })
      .from(users)
      .where(eq(users.id, TEST_USER.id))
      .all();
    expect(updated.assistantEnabled).toBe(false);
  });

  it("PUT updates tasksTodayFocusDefault to true", async () => {
    const res = await PUT(
      jsonReq("http://localhost/api/me", { tasksTodayFocusDefault: true }),
      {},
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      showAdminQuickAccess: true,
      assistantEnabled: true,
      tasksTodayFocusDefault: true,
      showDispatchHelp: true,
      notesMetadataCollapsedDefault: false,
      defaultStartNode: "dashboard",
    });

    const [updated] = testDb.db
      .select({ tasksTodayFocusDefault: users.tasksTodayFocusDefault })
      .from(users)
      .where(eq(users.id, TEST_USER.id))
      .all();
    expect(updated.tasksTodayFocusDefault).toBe(true);
  });

  it("PUT rejects invalid payload values", async () => {
    const res = await PUT(
      jsonReq("http://localhost/api/me", { showAdminQuickAccess: "nope" }),
      {},
    );
    expect(res.status).toBe(400);
  });

  it("PUT rejects invalid JSON body", async () => {
    const res = await PUT(
      new Request("http://localhost/api/me", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: "not-json",
      }),
      {},
    );
    expect(res.status).toBe(400);
  });

  it("PUT rejects payloads without preference fields", async () => {
    const res = await PUT(
      jsonReq("http://localhost/api/me", { ignored: true }),
      {},
    );
    expect(res.status).toBe(400);
  });

  it("PUT updates defaultStartNode to projects", async () => {
    const res = await PUT(
      jsonReq("http://localhost/api/me", { defaultStartNode: "projects" }),
      {},
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      showAdminQuickAccess: true,
      assistantEnabled: true,
      tasksTodayFocusDefault: false,
      showDispatchHelp: true,
      notesMetadataCollapsedDefault: false,
      defaultStartNode: "projects",
    });

    const [updated] = testDb.db
      .select({ defaultStartNode: users.defaultStartNode })
      .from(users)
      .where(eq(users.id, TEST_USER.id))
      .all();
    expect(updated.defaultStartNode).toBe("projects");
  });

  it("PUT rejects invalid defaultStartNode values", async () => {
    const res = await PUT(
      jsonReq("http://localhost/api/me", { defaultStartNode: "not-a-node" }),
      {},
    );
    expect(res.status).toBe(400);
  });

  it("PUT updates showDispatchHelp to false", async () => {
    const res = await PUT(
      jsonReq("http://localhost/api/me", { showDispatchHelp: false }),
      {},
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      showAdminQuickAccess: true,
      assistantEnabled: true,
      tasksTodayFocusDefault: false,
      showDispatchHelp: false,
      notesMetadataCollapsedDefault: false,
      defaultStartNode: "dashboard",
    });
  });

  it("PUT updates notesMetadataCollapsedDefault to true", async () => {
    const res = await PUT(
      jsonReq("http://localhost/api/me", { notesMetadataCollapsedDefault: true }),
      {},
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      showAdminQuickAccess: true,
      assistantEnabled: true,
      tasksTodayFocusDefault: false,
      showDispatchHelp: true,
      notesMetadataCollapsedDefault: true,
      defaultStartNode: "dashboard",
    });
  });

  it("PUT updates multiple preference fields in one request", async () => {
    const res = await PUT(
      jsonReq("http://localhost/api/me", {
        showAdminQuickAccess: false,
        assistantEnabled: false,
        tasksTodayFocusDefault: true,
        showDispatchHelp: false,
        notesMetadataCollapsedDefault: true,
        defaultStartNode: "tasks",
      }),
      {},
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      showAdminQuickAccess: false,
      assistantEnabled: false,
      tasksTodayFocusDefault: true,
      showDispatchHelp: false,
      notesMetadataCollapsedDefault: true,
      defaultStartNode: "tasks",
    });

    const [updated] = testDb.db
      .select({
        showAdminQuickAccess: users.showAdminQuickAccess,
        assistantEnabled: users.assistantEnabled,
        tasksTodayFocusDefault: users.tasksTodayFocusDefault,
        showDispatchHelp: users.showDispatchHelp,
        notesMetadataCollapsedDefault: users.notesMetadataCollapsedDefault,
        defaultStartNode: users.defaultStartNode,
      })
      .from(users)
      .where(eq(users.id, TEST_USER.id))
      .all();

    expect(updated).toEqual({
      showAdminQuickAccess: false,
      assistantEnabled: false,
      tasksTodayFocusDefault: true,
      showDispatchHelp: false,
      notesMetadataCollapsedDefault: true,
      defaultStartNode: "tasks",
    });
  });

  it("PUT requires authentication", async () => {
    mockSession(null);
    const res = await PUT(
      jsonReq("http://localhost/api/me", { showAdminQuickAccess: false }),
      {},
    );
    expect(res.status).toBe(401);
  });
});
