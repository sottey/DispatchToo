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
const { GET, POST } = await import("@/app/api/notes/route");
const {
  GET: GET_BY_ID,
  PUT,
  DELETE,
} = await import("@/app/api/notes/[id]/route");

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

describe("Notes API", () => {
  beforeEach(() => {
    testDb = createTestDb();
    testDb.db.insert(users).values(TEST_USER).run();
    testDb.db.insert(users).values(OTHER_USER).run();
    mockSession({ user: TEST_USER });
  });

  // --- Authentication ---

  describe("authentication", () => {
    it("GET /api/notes returns 401 when unauthenticated", async () => {
      mockSession(null);
      const res = await GET(new Request("http://localhost/api/notes"), {});
      expect(res.status).toBe(401);
    });

    it("POST /api/notes returns 401 when unauthenticated", async () => {
      mockSession(null);
      const res = await POST(
        jsonReq("http://localhost/api/notes", "POST", { title: "test" }),
        {}
      );
      expect(res.status).toBe(401);
    });
  });

  // --- POST /api/notes ---

  describe("POST /api/notes", () => {
    it("creates a note with just a title", async () => {
      const res = await POST(
        jsonReq("http://localhost/api/notes", "POST", { title: "My note" }),
        {}
      );
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.title).toBe("My note");
      expect(data.content).toBeNull();
      expect(data.userId).toBe(TEST_USER.id);
      expect(data.id).toBeDefined();
    });

    it("creates a note with title and content", async () => {
      const res = await POST(
        jsonReq("http://localhost/api/notes", "POST", {
          title: "Full note",
          content: "# Hello\n\nSome markdown content",
        }),
        {}
      );
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.title).toBe("Full note");
      expect(data.content).toBe("# Hello\n\nSome markdown content");
      expect(data.metadata).toBeNull();
    });

    it("parses and stores frontmatter metadata", async () => {
      const res = await POST(
        jsonReq("http://localhost/api/notes", "POST", {
          title: "Frontmatter note",
          content: `---
type: dispatch
tags:
  - Planning
  - weekly
---
Body`,
        }),
        {}
      );
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.type).toBe("dispatch");
      expect(data.hasRecurrence).toBe(false);
      expect(data.metadata?.type).toBe("dispatch");
      expect(data.metadata?.tags).toEqual(["planning", "weekly"]);
    });

    it("parses and stores frontmatter metadata with CRLF line endings", async () => {
      const res = await POST(
        jsonReq("http://localhost/api/notes", "POST", {
          title: "Frontmatter note CRLF",
          content: "---\r\ntype: dispatch\r\ntags:\r\n  - Planning\r\n  - weekly\r\n---\r\nBody",
        }),
        {}
      );
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.type).toBe("dispatch");
      expect(data.metadata?.tags).toEqual(["planning", "weekly"]);
    });

    it("rejects malformed frontmatter", async () => {
      const res = await POST(
        jsonReq("http://localhost/api/notes", "POST", {
          title: "Broken FM",
          content: `---
type: dispatch
tags: [a
---
Body`,
        }),
        {}
      );
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Invalid frontmatter");
      expect(Array.isArray(data.details)).toBe(true);
    });

    it("rejects recurrence in note frontmatter", async () => {
      const res = await POST(
        jsonReq("http://localhost/api/notes", "POST", {
          title: "Recurrence not supported",
          content: `---
recurrence:
  kind: weekly
  interval: 1
  timezone: America/New_York
---
Body`,
        }),
        {}
      );
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Invalid frontmatter");
      expect(data.details.some((item: { path: string }) => item.path === "recurrence")).toBe(true);
    });

    it("trims whitespace from title", async () => {
      const res = await POST(
        jsonReq("http://localhost/api/notes", "POST", { title: "  padded  " }),
        {}
      );
      const data = await res.json();
      expect(data.title).toBe("padded");
    });

    it("rejects missing title", async () => {
      const res = await POST(
        jsonReq("http://localhost/api/notes", "POST", {}),
        {}
      );
      expect(res.status).toBe(400);
    });

    it("rejects empty string title", async () => {
      const res = await POST(
        jsonReq("http://localhost/api/notes", "POST", { title: "   " }),
        {}
      );
      expect(res.status).toBe(400);
    });

    it("rejects non-string title", async () => {
      const res = await POST(
        jsonReq("http://localhost/api/notes", "POST", { title: 123 }),
        {}
      );
      expect(res.status).toBe(400);
    });

    it("rejects non-string content", async () => {
      const res = await POST(
        jsonReq("http://localhost/api/notes", "POST", {
          title: "test",
          content: 42,
        }),
        {}
      );
      expect(res.status).toBe(400);
    });

    it("rejects invalid JSON body", async () => {
      const res = await POST(
        new Request("http://localhost/api/notes", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "not json",
        }),
        {}
      );
      expect(res.status).toBe(400);
    });
  });

  // --- GET /api/notes ---

  describe("GET /api/notes", () => {
    beforeEach(async () => {
      await POST(
        jsonReq("http://localhost/api/notes", "POST", {
          title: "Meeting notes",
          content: "Discussion about roadmap",
        }),
        {}
      );
      await POST(
        jsonReq("http://localhost/api/notes", "POST", {
          title: "Shopping list",
          content: "Milk, eggs, bread",
        }),
        {}
      );
      await POST(
        jsonReq("http://localhost/api/notes", "POST", {
          title: "Ideas for project",
          content: "Build a dispatch app",
        }),
        {}
      );
    });

    it("returns all notes for the current user", async () => {
      const res = await GET(new Request("http://localhost/api/notes"), {});
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveLength(3);
    });

    it("filters by search query (case insensitive)", async () => {
      const res = await GET(
        new Request("http://localhost/api/notes?search=meeting"),
        {}
      );
      const data = await res.json();
      expect(data).toHaveLength(1);
      expect(data[0].title).toBe("Meeting notes");
    });

    it("search returns empty array when no match", async () => {
      const res = await GET(
        new Request("http://localhost/api/notes?search=nonexistent"),
        {}
      );
      const data = await res.json();
      expect(data).toHaveLength(0);
    });

    it("does not return notes belonging to other users", async () => {
      mockSession({ user: OTHER_USER });
      await POST(
        jsonReq("http://localhost/api/notes", "POST", {
          title: "Other user note",
        }),
        {}
      );

      mockSession({ user: TEST_USER });
      const res = await GET(new Request("http://localhost/api/notes"), {});
      const data = await res.json();
      expect(data).toHaveLength(3);
      expect(data.every((n: { userId: string }) => n.userId === TEST_USER.id)).toBe(true);
    });

    it("filters by type and tag", async () => {
      await POST(
        jsonReq("http://localhost/api/notes", "POST", {
          title: "Typed note",
          content: `---
type: meeting
tags: [planning]
---
Body`,
        }),
        {}
      );

      const typeRes = await GET(
        new Request("http://localhost/api/notes?type=meeting"),
        {}
      );
      const typeData = await typeRes.json();
      expect(typeData).toHaveLength(1);
      expect(typeData[0].type).toBe("meeting");

      const tagRes = await GET(
        new Request("http://localhost/api/notes?tag=planning"),
        {}
      );
      const tagData = await tagRes.json();
      expect(tagData).toHaveLength(1);
      expect(tagData[0].title).toBe("Typed note");
    });
  });

  // --- GET /api/notes/[id] ---

  describe("GET /api/notes/[id]", () => {
    it("returns a single note", async () => {
      const createRes = await POST(
        jsonReq("http://localhost/api/notes", "POST", {
          title: "Single note",
          content: "Content here",
        }),
        {}
      );
      const created = await createRes.json();

      const res = await GET_BY_ID(
        new Request(`http://localhost/api/notes/${created.id}`),
        ctx(created.id)
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe(created.id);
      expect(data.title).toBe("Single note");
      expect(data.content).toBe("Content here");
    });

    it("returns 404 for nonexistent note", async () => {
      const res = await GET_BY_ID(
        new Request("http://localhost/api/notes/nonexistent"),
        ctx("nonexistent")
      );
      expect(res.status).toBe(404);
    });

    it("returns 404 for another user's note", async () => {
      mockSession({ user: OTHER_USER });
      const createRes = await POST(
        jsonReq("http://localhost/api/notes", "POST", { title: "Secret note" }),
        {}
      );
      const created = await createRes.json();

      mockSession({ user: TEST_USER });
      const res = await GET_BY_ID(
        new Request(`http://localhost/api/notes/${created.id}`),
        ctx(created.id)
      );
      expect(res.status).toBe(404);
    });
  });

  // --- PUT /api/notes/[id] ---

  describe("PUT /api/notes/[id]", () => {
    it("updates note fields", async () => {
      const createRes = await POST(
        jsonReq("http://localhost/api/notes", "POST", {
          title: "Old title",
          content: "Old content",
        }),
        {}
      );
      const created = await createRes.json();

      const res = await PUT(
        jsonReq(`http://localhost/api/notes/${created.id}`, "PUT", {
          title: "New title",
          content: "New content",
        }),
        ctx(created.id)
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.title).toBe("New title");
      expect(data.content).toBe("New content");
    });

    it("allows partial updates", async () => {
      const createRes = await POST(
        jsonReq("http://localhost/api/notes", "POST", {
          title: "Keep this",
          content: "Original",
        }),
        {}
      );
      const created = await createRes.json();

      const res = await PUT(
        jsonReq(`http://localhost/api/notes/${created.id}`, "PUT", {
          content: "Updated",
        }),
        ctx(created.id)
      );
      const data = await res.json();
      expect(data.title).toBe("Keep this");
      expect(data.content).toBe("Updated");
    });

    it("updates frontmatter-derived metadata when content changes", async () => {
      const createRes = await POST(
        jsonReq("http://localhost/api/notes", "POST", {
          title: "Meta change",
          content: "No frontmatter",
        }),
        {}
      );
      const created = await createRes.json();

      const res = await PUT(
        jsonReq(`http://localhost/api/notes/${created.id}`, "PUT", {
          content: `---
type: journal
tags: [reflection]
---
Body`,
        }),
        ctx(created.id)
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.type).toBe("journal");
      expect(data.metadata?.tags).toEqual(["reflection"]);
    });

    it("updates updatedAt timestamp", async () => {
      const createRes = await POST(
        jsonReq("http://localhost/api/notes", "POST", { title: "Timing" }),
        {}
      );
      const created = await createRes.json();

      await new Promise((r) => setTimeout(r, 10));

      const res = await PUT(
        jsonReq(`http://localhost/api/notes/${created.id}`, "PUT", {
          title: "Updated",
        }),
        ctx(created.id)
      );
      const data = await res.json();
      expect(data.updatedAt).not.toBe(created.updatedAt);
    });

    it("returns 404 for nonexistent note", async () => {
      const res = await PUT(
        jsonReq("http://localhost/api/notes/nonexistent", "PUT", {
          title: "Nope",
        }),
        ctx("nonexistent")
      );
      expect(res.status).toBe(404);
    });

    it("returns 404 for another user's note", async () => {
      mockSession({ user: OTHER_USER });
      const createRes = await POST(
        jsonReq("http://localhost/api/notes", "POST", { title: "Theirs" }),
        {}
      );
      const created = await createRes.json();

      mockSession({ user: TEST_USER });
      const res = await PUT(
        jsonReq(`http://localhost/api/notes/${created.id}`, "PUT", {
          title: "Mine now",
        }),
        ctx(created.id)
      );
      expect(res.status).toBe(404);
    });

    it("rejects empty title on update", async () => {
      const createRes = await POST(
        jsonReq("http://localhost/api/notes", "POST", { title: "test" }),
        {}
      );
      const created = await createRes.json();

      const res = await PUT(
        jsonReq(`http://localhost/api/notes/${created.id}`, "PUT", {
          title: "",
        }),
        ctx(created.id)
      );
      expect(res.status).toBe(400);
    });

    it("rejects non-string content on update", async () => {
      const createRes = await POST(
        jsonReq("http://localhost/api/notes", "POST", { title: "test" }),
        {}
      );
      const created = await createRes.json();

      const res = await PUT(
        jsonReq(`http://localhost/api/notes/${created.id}`, "PUT", {
          content: 42,
        }),
        ctx(created.id)
      );
      expect(res.status).toBe(400);
    });
  });

  // --- DELETE /api/notes/[id] ---

  describe("DELETE /api/notes/[id]", () => {
    it("deletes a note", async () => {
      const createRes = await POST(
        jsonReq("http://localhost/api/notes", "POST", { title: "Delete me" }),
        {}
      );
      const created = await createRes.json();

      const res = await DELETE(
        new Request(`http://localhost/api/notes/${created.id}`, {
          method: "DELETE",
        }),
        ctx(created.id)
      );
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ deleted: true });

      // Confirm it's gone
      const getRes = await GET_BY_ID(
        new Request(`http://localhost/api/notes/${created.id}`),
        ctx(created.id)
      );
      expect(getRes.status).toBe(404);
    });

    it("returns 404 for nonexistent note", async () => {
      const res = await DELETE(
        new Request("http://localhost/api/notes/nonexistent", {
          method: "DELETE",
        }),
        ctx("nonexistent")
      );
      expect(res.status).toBe(404);
    });

    it("returns 404 for another user's note", async () => {
      mockSession({ user: OTHER_USER });
      const createRes = await POST(
        jsonReq("http://localhost/api/notes", "POST", { title: "Not yours" }),
        {}
      );
      const created = await createRes.json();

      mockSession({ user: TEST_USER });
      const res = await DELETE(
        new Request(`http://localhost/api/notes/${created.id}`, {
          method: "DELETE",
        }),
        ctx(created.id)
      );
      expect(res.status).toBe(404);
    });
  });
});
