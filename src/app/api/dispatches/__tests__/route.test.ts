import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockSession } from "@/test/setup";
import { createTestDb } from "@/test/db";
import { users } from "@/db/schema";

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
