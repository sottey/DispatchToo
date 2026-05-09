import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb } from "@/test/db";
import { mockSession } from "@/test/setup";
import { notes, projects, users } from "@/db/schema";

let testDb: ReturnType<typeof createTestDb>;

vi.mock("@/db", () => ({
  get db() {
    return testDb.db;
  },
}));

const { POST } = await import("@/app/api/notes/import/route");

const TEST_USER = { id: "user-1", name: "Test User", email: "test@test.com" };

function jsonReq(body: unknown) {
  return new Request("http://localhost/api/notes/import", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Notes Import API", () => {
  beforeEach(() => {
    testDb = createTestDb();
    testDb.db.insert(users).values(TEST_USER).run();
    testDb.db
      .insert(projects)
      .values({
        id: "project_ops",
        userId: TEST_USER.id,
        name: "Ops",
        status: "active",
        color: "blue",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .run();
    mockSession({ user: TEST_USER });
  });

  it("imports markdown notes with folder path metadata", async () => {
    const res = await POST(
      jsonReq({
        files: [
          {
            relativePath: "clients/acme/meeting-notes.md",
            content: "# Hello",
          },
        ],
      }),
      {},
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.imported).toBe(1);
    expect(data.skipped).toBe(0);
    expect(data.failed).toBe(0);
    expect(data.importedNotes[0].title).toBe("meeting-notes");
    expect(data.importedNotes[0].folderId).toBe("clients/acme");
    expect(data.importedNotes[0].metadata.importRelativePath).toBe("clients/acme/meeting-notes.md");
    expect(data.importedNotes[0].metadata.importSource).toBe("folder-import");
  });

  it("skips duplicates by exact stored relative path", async () => {
    await POST(
      jsonReq({
        files: [
          {
            relativePath: "clients/acme/meeting-notes.md",
            content: "# Hello",
          },
        ],
      }),
      {},
    );

    const res = await POST(
      jsonReq({
        files: [
          {
            relativePath: "clients/acme/meeting-notes.md",
            content: "# Updated",
          },
        ],
      }),
      {},
    );

    const data = await res.json();
    expect(data.imported).toBe(0);
    expect(data.skipped).toBe(1);
    expect(data.skippedPaths).toEqual(["clients/acme/meeting-notes.md"]);
  });

  it("preserves and merges frontmatter metadata", async () => {
    const res = await POST(
      jsonReq({
        files: [
          {
            relativePath: "ops/weekly.md",
            content: `---
type: meeting
projectId: project_ops
tags: [Planning]
---
Body`,
          },
        ],
      }),
      {},
    );

    const data = await res.json();
    expect(data.importedNotes[0].type).toBe("meeting");
    expect(data.importedNotes[0].projectId).toBe("project_ops");
    expect(data.importedNotes[0].metadata.tags).toEqual(["planning"]);
    expect(data.importedNotes[0].metadata.importRelativePath).toBe("ops/weekly.md");
  });

  it("fails invalid frontmatter without aborting the entire batch", async () => {
    const res = await POST(
      jsonReq({
        files: [
          {
            relativePath: "valid.md",
            content: "# Fine",
          },
          {
            relativePath: "broken.md",
            content: `---
tags: [a
---
Body`,
          },
        ],
      }),
      {},
    );

    const data = await res.json();
    expect(data.imported).toBe(1);
    expect(data.failed).toBe(1);
    expect(data.failures[0].relativePath).toBe("broken.md");
  });

  it("rejects more than 100 files in one batch", async () => {
    const files = Array.from({ length: 101 }, (_value, index) => ({
      relativePath: `note-${index}.md`,
      content: "# Too many",
    }));

    const res = await POST(jsonReq({ files }), {});
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: "files must contain at most 100 entries",
    });
  });

  it("returns 401 when unauthenticated", async () => {
    mockSession(null);
    const res = await POST(
      jsonReq({
        files: [{ relativePath: "a.md", content: "# Test" }],
      }),
      {},
    );
    expect(res.status).toBe(401);
  });

  it("stores imported notes in the database", async () => {
    await POST(
      jsonReq({
        files: [{ relativePath: "area/sub/note.md", content: "# Test" }],
      }),
      {},
    );

    const stored = testDb.db.select().from(notes).all();
    expect(stored).toHaveLength(1);
    expect(stored[0].folderId).toBe("area/sub");
  });
});
