import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockSession } from "@/test/setup";
import { createTestDb } from "@/test/db";
import { users } from "@/db/schema";

let testDb: ReturnType<typeof createTestDb>;

vi.mock("@/db", () => ({
  get db() {
    return testDb.db;
  },
}));

const { GET, POST } = await import("@/app/api/projects/route");
const {
  GET: GET_BY_ID,
  PUT,
  DELETE,
} = await import("@/app/api/projects/[id]/route");
const { GET: GET_PROJECT_TASKS } = await import("@/app/api/projects/[id]/tasks/route");
const { POST: CREATE_TASK } = await import("@/app/api/tasks/route");
const { GET: GET_TASK } = await import("@/app/api/tasks/[id]/route");

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

async function createProject(name = "Project Alpha") {
  const res = await POST(
    jsonReq("http://localhost/api/projects", "POST", { name }),
    {}
  );
  return res.json();
}

describe("Projects API", () => {
  beforeEach(() => {
    testDb = createTestDb();
    testDb.db.insert(users).values(TEST_USER).run();
    testDb.db.insert(users).values(OTHER_USER).run();
    mockSession({ user: TEST_USER });
  });

  describe("authentication", () => {
    it("GET /api/projects returns 401 when unauthenticated", async () => {
      mockSession(null);
      const res = await GET(new Request("http://localhost/api/projects"), {});
      expect(res.status).toBe(401);
    });

    it("POST /api/projects returns 401 when unauthenticated", async () => {
      mockSession(null);
      const res = await POST(
        jsonReq("http://localhost/api/projects", "POST", { name: "X" }),
        {}
      );
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/projects", () => {
    it("creates a project with defaults", async () => {
      const res = await POST(
        jsonReq("http://localhost/api/projects", "POST", { name: "My Project" }),
        {}
      );
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.name).toBe("My Project");
      expect(data.status).toBe("active");
      expect(data.color).toBe("blue");
      expect(data.userId).toBe(TEST_USER.id);
    });

    it("rejects missing name", async () => {
      const res = await POST(
        jsonReq("http://localhost/api/projects", "POST", {}),
        {}
      );
      expect(res.status).toBe(400);
    });

    it("rejects invalid status", async () => {
      const res = await POST(
        jsonReq("http://localhost/api/projects", "POST", { name: "Test", status: "bad" }),
        {}
      );
      expect(res.status).toBe(400);
    });

    it("rejects invalid color", async () => {
      const res = await POST(
        jsonReq("http://localhost/api/projects", "POST", { name: "Test", color: "pink" }),
        {}
      );
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/projects", () => {
    it("returns only current user's projects", async () => {
      await createProject("Mine");
      mockSession({ user: OTHER_USER });
      await POST(
        jsonReq("http://localhost/api/projects", "POST", { name: "Theirs" }),
        {}
      );
      mockSession({ user: TEST_USER });
      const res = await GET(new Request("http://localhost/api/projects"), {});
      const data = await res.json();
      expect(data).toHaveLength(1);
      expect(data[0].name).toBe("Mine");
    });

    it("filters by status", async () => {
      await POST(
        jsonReq("http://localhost/api/projects", "POST", { name: "Active", status: "active" }),
        {}
      );
      await POST(
        jsonReq("http://localhost/api/projects", "POST", { name: "Paused", status: "paused" }),
        {}
      );
      const res = await GET(new Request("http://localhost/api/projects?status=paused"), {});
      const data = await res.json();
      expect(data).toHaveLength(1);
      expect(data[0].name).toBe("Paused");
    });

    it("returns stats when include=stats", async () => {
      const project = await createProject("Stats Project");
      await CREATE_TASK(
        jsonReq("http://localhost/api/tasks", "POST", { title: "Task A", projectId: project.id }),
        {}
      );
      const res = await GET(new Request("http://localhost/api/projects?include=stats"), {});
      const data = await res.json();
      expect(data[0].stats).toBeDefined();
      expect(data[0].stats.total).toBe(1);
    });
  });

  describe("GET /api/projects/[id]", () => {
    it("returns a project", async () => {
      const project = await createProject("Single");
      const res = await GET_BY_ID(
        new Request(`http://localhost/api/projects/${project.id}`),
        ctx(project.id)
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe(project.id);
    });

    it("returns 404 for another user's project", async () => {
      mockSession({ user: OTHER_USER });
      const project = await createProject("Other");
      mockSession({ user: TEST_USER });
      const res = await GET_BY_ID(
        new Request(`http://localhost/api/projects/${project.id}`),
        ctx(project.id)
      );
      expect(res.status).toBe(404);
    });
  });

  describe("PUT /api/projects/[id]", () => {
    it("updates a project", async () => {
      const project = await createProject("Old");
      const res = await PUT(
        jsonReq(`http://localhost/api/projects/${project.id}`, "PUT", {
          name: "New",
          status: "paused",
          color: "emerald",
        }),
        ctx(project.id)
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.name).toBe("New");
      expect(data.status).toBe("paused");
      expect(data.color).toBe("emerald");
    });

    it("returns 404 for another user's project", async () => {
      mockSession({ user: OTHER_USER });
      const project = await createProject("Other");
      mockSession({ user: TEST_USER });
      const res = await PUT(
        jsonReq(`http://localhost/api/projects/${project.id}`, "PUT", {
          name: "Nope",
        }),
        ctx(project.id)
      );
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/projects/[id]", () => {
    it("clears projectId on tasks and deletes project", async () => {
      const project = await createProject("Delete Me");
      const taskRes = await CREATE_TASK(
        jsonReq("http://localhost/api/tasks", "POST", { title: "Task A", projectId: project.id }),
        {}
      );
      const task = await taskRes.json();

      const del = await DELETE(
        new Request(`http://localhost/api/projects/${project.id}`, { method: "DELETE" }),
        ctx(project.id)
      );
      expect(del.status).toBe(200);

      const taskGet = await GET_TASK(
        new Request(`http://localhost/api/tasks/${task.id}`),
        ctx(task.id)
      );
      const taskData = await taskGet.json();
      expect(taskData.projectId).toBeNull();
    });

    it("returns 404 for another user's project", async () => {
      mockSession({ user: OTHER_USER });
      const project = await createProject("Other");
      mockSession({ user: TEST_USER });
      const res = await DELETE(
        new Request(`http://localhost/api/projects/${project.id}`, { method: "DELETE" }),
        ctx(project.id)
      );
      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/projects/[id]/tasks", () => {
    it("lists tasks in the project", async () => {
      const project = await createProject("Tasks Project");
      await CREATE_TASK(
        jsonReq("http://localhost/api/tasks", "POST", { title: "Task 1", projectId: project.id }),
        {}
      );
      await CREATE_TASK(
        jsonReq("http://localhost/api/tasks", "POST", { title: "Task 2", projectId: project.id }),
        {}
      );
      const res = await GET_PROJECT_TASKS(
        new Request(`http://localhost/api/projects/${project.id}/tasks`),
        ctx(project.id)
      );
      const data = await res.json();
      expect(data).toHaveLength(2);
    });
  });
});
