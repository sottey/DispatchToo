import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb } from "@/test/db";
import { mockSession } from "@/test/setup";
import { notes, users } from "@/db/schema";

let testDb: ReturnType<typeof createTestDb>;

vi.mock("@/db", () => ({
  get db() {
    return testDb.db;
  },
}));

const { GET } = await import("@/app/api/notes/tags/route");

const TEST_USER = {
  id: "user-1",
  name: "Test User",
  email: "test@example.com",
};

const OTHER_USER = {
  id: "user-2",
  name: "Other User",
  email: "other@example.com",
};

describe("Notes Tags API", () => {
  beforeEach(() => {
    testDb = createTestDb();
    testDb.db.insert(users).values(TEST_USER).run();
    testDb.db.insert(users).values(OTHER_USER).run();
    mockSession({ user: TEST_USER });

    const now = new Date().toISOString();

    testDb.db
      .insert(notes)
      .values([
        {
          id: "n1",
          userId: TEST_USER.id,
          title: "metadata tags",
          metadata: JSON.stringify({ tags: [" Planning ", "weekly", "", 123] }),
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "n2",
          userId: TEST_USER.id,
          title: "metadata keywords",
          metadata: JSON.stringify({ keywords: "weekly, Focus , " }),
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "n3",
          userId: TEST_USER.id,
          title: "frontmatter fallback",
          content: "---\ntag: Roadmap\n---\nBody",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "n4",
          userId: TEST_USER.id,
          title: "invalid metadata with frontmatter fallback",
          metadata: "{invalid-json",
          content: "---\ntags:\n  - fallback\n---\nBody",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "n5",
          userId: TEST_USER.id,
          title: "malformed frontmatter ignored",
          content: "---\ntags: [broken\nBody",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "n6",
          userId: TEST_USER.id,
          title: "deleted note ignored",
          metadata: JSON.stringify({ tags: ["planning"] }),
          deletedAt: now,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "n7",
          userId: OTHER_USER.id,
          title: "other user ignored",
          metadata: JSON.stringify({ tags: ["planning"] }),
          createdAt: now,
          updatedAt: now,
        },
      ])
      .run();
  });

  it("returns 401 when unauthenticated", async () => {
    mockSession(null);
    const res = await GET(new Request("http://localhost/api/notes/tags"), {});
    expect(res.status).toBe(401);
  });

  it("counts tags from metadata and frontmatter fallback and sorts output", async () => {
    const res = await GET(new Request("http://localhost/api/notes/tags"), {});
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toEqual([
      { tag: "weekly", count: 2 },
      { tag: "fallback", count: 1 },
      { tag: "focus", count: 1 },
      { tag: "planning", count: 1 },
      { tag: "roadmap", count: 1 },
    ]);
  });
});
