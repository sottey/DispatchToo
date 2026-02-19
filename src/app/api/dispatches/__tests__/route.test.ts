import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockSession } from "@/test/setup";
import { createTestDb } from "@/test/db";
import { dispatchTasks, notes, tasks, users } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";

// Set up a fresh in-memory DB before each test and mock @/db
let testDb: ReturnType<typeof createTestDb>;

vi.mock("@/db", () => ({
  get db() {
    return testDb.db;
  },
}));

// Import route handlers AFTER mocks are set up
const { GET, POST } = await import("@/app/api/dispatches/route");
const {
  GET: GET_BY_ID,
  PUT,
  DELETE,
} = await import("@/app/api/dispatches/[id]/route");

const TEST_USER = { id: "user-1", name: "Test User", email: "test@test.com" };
const OTHER_USER = { id: "user-2", name: "Other User", email: "other@test.com" };

function jsonReq(url: string, method: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("Dispatches API", () => {
  beforeEach(() => {
    testDb = createTestDb();
    testDb.db.insert(users).values(TEST_USER).run();
    testDb.db.insert(users).values(OTHER_USER).run();
    mockSession({ user: TEST_USER });
  });

  // --- Authentication ---

  describe("authentication", () => {
    it("GET /api/dispatches returns 401 when unauthenticated", async () => {
      mockSession(null);
      const res = await GET(new Request("http://localhost/api/dispatches"), {});
      expect(res.status).toBe(401);
    });

    it("POST /api/dispatches returns 401 when unauthenticated", async () => {
      mockSession(null);
      const res = await POST(
        jsonReq("http://localhost/api/dispatches", "POST", { date: "2025-01-15" }),
        {}
      );
      expect(res.status).toBe(401);
    });
  });

  // --- POST /api/dispatches ---

  describe("POST /api/dispatches", () => {
    it("creates a dispatch with just a date", async () => {
      const res = await POST(
        jsonReq("http://localhost/api/dispatches", "POST", { date: "2025-06-15" }),
        {}
      );
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.date).toBe("2025-06-15");
      expect(data.summary).toBeNull();
      expect(data.finalized).toBe(false);
      expect(data.userId).toBe(TEST_USER.id);
      expect(data.id).toBeDefined();
    });

    it("creates a dispatch with a summary", async () => {
      const res = await POST(
        jsonReq("http://localhost/api/dispatches", "POST", {
          date: "2025-06-15",
          summary: "Productive day",
        }),
        {}
      );
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.summary).toBe("Productive day");
    });

    it("rejects missing date", async () => {
      const res = await POST(
        jsonReq("http://localhost/api/dispatches", "POST", {}),
        {}
      );
      expect(res.status).toBe(400);
    });

    it("rejects invalid date format", async () => {
      const res = await POST(
        jsonReq("http://localhost/api/dispatches", "POST", { date: "June 15, 2025" }),
        {}
      );
      expect(res.status).toBe(400);
    });

    it("rejects non-string date", async () => {
      const res = await POST(
        jsonReq("http://localhost/api/dispatches", "POST", { date: 20250615 }),
        {}
      );
      expect(res.status).toBe(400);
    });

    it("rejects non-string summary", async () => {
      const res = await POST(
        jsonReq("http://localhost/api/dispatches", "POST", {
          date: "2025-06-15",
          summary: 42,
        }),
        {}
      );
      expect(res.status).toBe(400);
    });

    it("rejects duplicate date for same user", async () => {
      await POST(
        jsonReq("http://localhost/api/dispatches", "POST", { date: "2025-06-15" }),
        {}
      );
      const res = await POST(
        jsonReq("http://localhost/api/dispatches", "POST", { date: "2025-06-15" }),
        {}
      );
      expect(res.status).toBe(409);
    });

    it("allows same date for different users", async () => {
      await POST(
        jsonReq("http://localhost/api/dispatches", "POST", { date: "2025-06-15" }),
        {}
      );

      mockSession({ user: OTHER_USER });
      const res = await POST(
        jsonReq("http://localhost/api/dispatches", "POST", { date: "2025-06-15" }),
        {}
      );
      expect(res.status).toBe(201);
    });

    it("rejects invalid JSON body", async () => {
      const res = await POST(
        new Request("http://localhost/api/dispatches", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "not json",
        }),
        {}
      );
      expect(res.status).toBe(400);
    });

    it("creates template tasks for matching day/month/dom conditions", async () => {
      testDb.db
        .insert(notes)
        .values({
          id: "note-template-1",
          userId: TEST_USER.id,
          title: "TasklistTemplate",
          content: [
            "{{if:day=sat}}",
            "- [ ] Weeding #home +home >{{date:YYYY-MM-DD}}",
            "{{endif}}",
            "{{if:day=weekday}}",
            "- [ ] Weekday-only task",
            "{{endif}}",
            "{{if:day=weekend}}",
            "- [ ] Weekend-only task",
            "{{endif}}",
            "{{if:day=everyday}}",
            "- [ ] Daily standup",
            "{{endif}}",
            "{{if:day=weekday,weekend}}",
            "- [ ] Any-day task",
            "{{endif}}",
            "{{if:dom=14}}",
            "- [ ] Mid-month check >{{date:YYYY-MM-DD}}",
            "{{endif}}",
            "{{if:month=jun&dom=14}}",
            "- [ ] Anniversary reminder",
            "{{endif}}",
            "{{if:day=sat,wed}}",
            "- [ ] Multi-day task",
            "{{endif}}",
          ].join("\n"),
        })
        .run();

      const res = await POST(
        jsonReq("http://localhost/api/dispatches", "POST", { date: "2025-06-14" }),
        {},
      );

      expect(res.status).toBe(201);
      const createdDispatch = await res.json();

      const linkedRows = testDb.db
        .select({
          title: tasks.title,
          dueDate: tasks.dueDate,
        })
        .from(dispatchTasks)
        .innerJoin(tasks, eq(dispatchTasks.taskId, tasks.id))
        .where(eq(dispatchTasks.dispatchId, createdDispatch.id))
        .all();

      expect(linkedRows.map((row) => row.title).sort()).toEqual([
        "Anniversary reminder",
        "Any-day task",
        "Daily standup",
        "Mid-month check",
        "Multi-day task",
        "Weeding #home +home",
        "Weekend-only task",
      ]);

      const dueDatesByTitle = new Map(linkedRows.map((row) => [row.title, row.dueDate]));
      expect(dueDatesByTitle.get("Weeding #home +home")).toBe("2025-06-14");
      expect(dueDatesByTitle.get("Mid-month check")).toBe("2025-06-14");
      expect(dueDatesByTitle.get("Anniversary reminder")).toBeNull();
    });

    it("does not create template tasks when conditions do not match", async () => {
      testDb.db
        .insert(notes)
        .values({
          id: "note-template-2",
          userId: TEST_USER.id,
          title: "TasklistTemplate",
          content: [
            "{{if:day=sat}}",
            "- [ ] Weekend chore",
            "{{endif}}",
            "{{if:month=jan&dom=15}}",
            "- [ ] Tax reminder",
            "{{endif}}",
          ].join("\n"),
        })
        .run();

      const res = await POST(
        jsonReq("http://localhost/api/dispatches", "POST", { date: "2025-06-16" }),
        {},
      );

      expect(res.status).toBe(201);
      const createdDispatch = await res.json();

      const linkedRows = testDb.db
        .select({ taskId: dispatchTasks.taskId })
        .from(dispatchTasks)
        .where(eq(dispatchTasks.dispatchId, createdDispatch.id))
        .all();

      expect(linkedRows).toHaveLength(0);
    });

    it("supports inline single-line if syntax without endif", async () => {
      testDb.db
        .insert(notes)
        .values({
          id: "note-template-inline",
          userId: TEST_USER.id,
          title: "TasklistTemplate",
          content: [
            "{{if:day=tue}}- [ ] Take out bins #home +home >{{date:YYYY-MM-DD}}",
            "{{if:day=wed}}- [ ] Bring in bins #home +home >{{date:YYYY-MM-DD}}",
            "{{if:month=jan&dom=15}}- [ ] Emma's Birthday #home +home >{{date:YYYY-MM-DD}}",
          ].join("\n"),
        })
        .run();

      const tuesdayRes = await POST(
        jsonReq("http://localhost/api/dispatches", "POST", { date: "2025-06-17" }),
        {},
      );
      expect(tuesdayRes.status).toBe(201);
      const tuesdayDispatch = await tuesdayRes.json();

      const tuesdayTasks = testDb.db
        .select({ title: tasks.title, dueDate: tasks.dueDate })
        .from(dispatchTasks)
        .innerJoin(tasks, eq(dispatchTasks.taskId, tasks.id))
        .where(eq(dispatchTasks.dispatchId, tuesdayDispatch.id))
        .all();

      expect(tuesdayTasks).toHaveLength(1);
      expect(tuesdayTasks[0].title).toBe("Take out bins #home +home");
      expect(tuesdayTasks[0].dueDate).toBe("2025-06-17");
    });
  });

  // --- GET /api/dispatches ---

  describe("GET /api/dispatches", () => {
    beforeEach(async () => {
      await POST(
        jsonReq("http://localhost/api/dispatches", "POST", { date: "2025-06-14" }),
        {}
      );
      await POST(
        jsonReq("http://localhost/api/dispatches", "POST", { date: "2025-06-15" }),
        {}
      );
      await POST(
        jsonReq("http://localhost/api/dispatches", "POST", { date: "2025-06-16" }),
        {}
      );
    });

    it("returns all dispatches for the current user", async () => {
      const res = await GET(new Request("http://localhost/api/dispatches"), {});
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveLength(3);
    });

    it("filters by date", async () => {
      const res = await GET(
        new Request("http://localhost/api/dispatches?date=2025-06-15"),
        {}
      );
      const data = await res.json();
      expect(data).toHaveLength(1);
      expect(data[0].date).toBe("2025-06-15");
    });

    it("does not return dispatches belonging to other users", async () => {
      mockSession({ user: OTHER_USER });
      await POST(
        jsonReq("http://localhost/api/dispatches", "POST", { date: "2025-06-17" }),
        {}
      );

      mockSession({ user: TEST_USER });
      const res = await GET(new Request("http://localhost/api/dispatches"), {});
      const data = await res.json();
      expect(data).toHaveLength(3);
      expect(data.every((d: { userId: string }) => d.userId === TEST_USER.id)).toBe(true);
    });
  });

  // --- GET /api/dispatches/[id] ---

  describe("GET /api/dispatches/[id]", () => {
    it("returns a single dispatch", async () => {
      const createRes = await POST(
        jsonReq("http://localhost/api/dispatches", "POST", { date: "2025-06-15" }),
        {}
      );
      const created = await createRes.json();

      const res = await GET_BY_ID(
        new Request(`http://localhost/api/dispatches/${created.id}`),
        ctx(created.id)
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe(created.id);
      expect(data.date).toBe("2025-06-15");
    });

    it("returns 404 for nonexistent dispatch", async () => {
      const res = await GET_BY_ID(
        new Request("http://localhost/api/dispatches/nonexistent"),
        ctx("nonexistent")
      );
      expect(res.status).toBe(404);
    });

    it("returns 404 for another user's dispatch", async () => {
      mockSession({ user: OTHER_USER });
      const createRes = await POST(
        jsonReq("http://localhost/api/dispatches", "POST", { date: "2025-06-15" }),
        {}
      );
      const created = await createRes.json();

      mockSession({ user: TEST_USER });
      const res = await GET_BY_ID(
        new Request(`http://localhost/api/dispatches/${created.id}`),
        ctx(created.id)
      );
      expect(res.status).toBe(404);
    });
  });

  // --- PUT /api/dispatches/[id] ---

  describe("PUT /api/dispatches/[id]", () => {
    it("updates the summary", async () => {
      const createRes = await POST(
        jsonReq("http://localhost/api/dispatches", "POST", { date: "2025-06-15" }),
        {}
      );
      const created = await createRes.json();

      const res = await PUT(
        jsonReq(`http://localhost/api/dispatches/${created.id}`, "PUT", {
          summary: "Updated summary",
        }),
        ctx(created.id)
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.summary).toBe("Updated summary");
    });

    it("updates updatedAt timestamp", async () => {
      const createRes = await POST(
        jsonReq("http://localhost/api/dispatches", "POST", { date: "2025-06-15" }),
        {}
      );
      const created = await createRes.json();

      await new Promise((r) => setTimeout(r, 10));

      const res = await PUT(
        jsonReq(`http://localhost/api/dispatches/${created.id}`, "PUT", {
          summary: "New",
        }),
        ctx(created.id)
      );
      const data = await res.json();
      expect(data.updatedAt).not.toBe(created.updatedAt);
    });

    it("creates a same-day dispatch note when summary is saved", async () => {
      const createRes = await POST(
        jsonReq("http://localhost/api/dispatches", "POST", { date: "2025-06-15" }),
        {}
      );
      const created = await createRes.json();

      const res = await PUT(
        jsonReq(`http://localhost/api/dispatches/${created.id}`, "PUT", {
          summary: "Journal entry for the day",
        }),
        ctx(created.id)
      );
      expect(res.status).toBe(200);

      const [dispatchNote] = await testDb.db
        .select()
        .from(notes)
        .where(
          and(
            eq(notes.userId, TEST_USER.id),
            eq(notes.title, "Daily Dispatch - 2025-06-15"),
            isNull(notes.deletedAt),
          )
        );

      expect(dispatchNote).toBeDefined();
      expect(dispatchNote?.content).toBe("Journal entry for the day");
    });

    it("updates the same-day dispatch note instead of creating duplicates", async () => {
      const createRes = await POST(
        jsonReq("http://localhost/api/dispatches", "POST", { date: "2025-06-15" }),
        {}
      );
      const created = await createRes.json();

      const firstSave = await PUT(
        jsonReq(`http://localhost/api/dispatches/${created.id}`, "PUT", {
          summary: "Morning plan",
        }),
        ctx(created.id)
      );
      expect(firstSave.status).toBe(200);

      const secondSave = await PUT(
        jsonReq(`http://localhost/api/dispatches/${created.id}`, "PUT", {
          summary: "Evening reflection",
        }),
        ctx(created.id)
      );
      expect(secondSave.status).toBe(200);

      const dispatchNotes = await testDb.db
        .select()
        .from(notes)
        .where(
          and(
            eq(notes.userId, TEST_USER.id),
            eq(notes.title, "Daily Dispatch - 2025-06-15"),
            isNull(notes.deletedAt),
          )
        );

      expect(dispatchNotes).toHaveLength(1);
      expect(dispatchNotes[0].content).toBe("Evening reflection");
    });

    it("rejects editing a finalized dispatch", async () => {
      // Create and finalize a dispatch
      const createRes = await POST(
        jsonReq("http://localhost/api/dispatches", "POST", { date: "2025-06-15" }),
        {}
      );
      const created = await createRes.json();

      // Finalize directly in DB
      testDb.sqlite.exec(`UPDATE dispatch SET finalized = 1 WHERE id = '${created.id}'`);

      const res = await PUT(
        jsonReq(`http://localhost/api/dispatches/${created.id}`, "PUT", {
          summary: "Should fail",
        }),
        ctx(created.id)
      );
      expect(res.status).toBe(400);
    });

    it("returns 404 for nonexistent dispatch", async () => {
      const res = await PUT(
        jsonReq("http://localhost/api/dispatches/nonexistent", "PUT", {
          summary: "Nope",
        }),
        ctx("nonexistent")
      );
      expect(res.status).toBe(404);
    });

    it("returns 404 for another user's dispatch", async () => {
      mockSession({ user: OTHER_USER });
      const createRes = await POST(
        jsonReq("http://localhost/api/dispatches", "POST", { date: "2025-06-15" }),
        {}
      );
      const created = await createRes.json();

      mockSession({ user: TEST_USER });
      const res = await PUT(
        jsonReq(`http://localhost/api/dispatches/${created.id}`, "PUT", {
          summary: "Steal",
        }),
        ctx(created.id)
      );
      expect(res.status).toBe(404);
    });
  });

  // --- DELETE /api/dispatches/[id] ---

  describe("DELETE /api/dispatches/[id]", () => {
    it("deletes a dispatch", async () => {
      const createRes = await POST(
        jsonReq("http://localhost/api/dispatches", "POST", { date: "2025-06-15" }),
        {}
      );
      const created = await createRes.json();

      const res = await DELETE(
        new Request(`http://localhost/api/dispatches/${created.id}`, {
          method: "DELETE",
        }),
        ctx(created.id)
      );
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ deleted: true });

      // Confirm it's gone
      const getRes = await GET_BY_ID(
        new Request(`http://localhost/api/dispatches/${created.id}`),
        ctx(created.id)
      );
      expect(getRes.status).toBe(404);
    });

    it("returns 404 for nonexistent dispatch", async () => {
      const res = await DELETE(
        new Request("http://localhost/api/dispatches/nonexistent", {
          method: "DELETE",
        }),
        ctx("nonexistent")
      );
      expect(res.status).toBe(404);
    });

    it("returns 404 for another user's dispatch", async () => {
      mockSession({ user: OTHER_USER });
      const createRes = await POST(
        jsonReq("http://localhost/api/dispatches", "POST", { date: "2025-06-15" }),
        {}
      );
      const created = await createRes.json();

      mockSession({ user: TEST_USER });
      const res = await DELETE(
        new Request(`http://localhost/api/dispatches/${created.id}`, {
          method: "DELETE",
        }),
        ctx(created.id)
      );
      expect(res.status).toBe(404);
    });
  });
});
