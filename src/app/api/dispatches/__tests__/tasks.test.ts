import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockSession } from "@/test/setup";
import { createTestDb } from "@/test/db";
import { notes, users } from "@/db/schema";

let testDb: ReturnType<typeof createTestDb>;

vi.mock("@/db", () => ({
  get db() {
    return testDb.db;
  },
}));

// Import route handlers AFTER mocks
const { POST: CREATE_DISPATCH } = await import("@/app/api/dispatches/route");
const {
  GET: GET_DISPATCH_TASKS,
  POST: LINK_TASK,
  DELETE: UNLINK_TASK,
} = await import("@/app/api/dispatches/[id]/tasks/route");
const { POST: COMPLETE_DAY } = await import(
  "@/app/api/dispatches/[id]/complete/route"
);
const { POST: CREATE_TASK } = await import("@/app/api/tasks/route");
const { GET: GET_DISPATCH } = await import("@/app/api/dispatches/[id]/route");

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

async function createDispatch(date: string) {
  const res = await CREATE_DISPATCH(
    jsonReq("http://localhost/api/dispatches", "POST", { date }),
    {}
  );
  return res.json();
}

async function createTask(title: string, extras?: Record<string, unknown>) {
  const res = await CREATE_TASK(
    jsonReq("http://localhost/api/tasks", "POST", { title, ...extras }),
    {}
  );
  return res.json();
}

describe("Dispatch Task Linking", () => {
  beforeEach(() => {
    testDb = createTestDb();
    testDb.db.insert(users).values(TEST_USER).run();
    testDb.db.insert(users).values(OTHER_USER).run();
    mockSession({ user: TEST_USER });
  });

  // --- Link task ---

  describe("POST /api/dispatches/[id]/tasks (link)", () => {
    it("links a task to a dispatch", async () => {
      const dispatch = await createDispatch("2025-06-15");
      const task = await createTask("My task");

      const res = await LINK_TASK(
        jsonReq(`http://localhost/api/dispatches/${dispatch.id}/tasks`, "POST", {
          taskId: task.id,
        }),
        ctx(dispatch.id)
      );
      expect(res.status).toBe(201);
      expect(await res.json()).toEqual({ linked: true });
    });

    it("returns linked tasks via GET", async () => {
      const dispatch = await createDispatch("2025-06-15");
      const task1 = await createTask("Task 1");
      const task2 = await createTask("Task 2");

      await LINK_TASK(
        jsonReq(`http://localhost/api/dispatches/${dispatch.id}/tasks`, "POST", {
          taskId: task1.id,
        }),
        ctx(dispatch.id)
      );
      await LINK_TASK(
        jsonReq(`http://localhost/api/dispatches/${dispatch.id}/tasks`, "POST", {
          taskId: task2.id,
        }),
        ctx(dispatch.id)
      );

      const res = await GET_DISPATCH_TASKS(
        new Request(`http://localhost/api/dispatches/${dispatch.id}/tasks`),
        ctx(dispatch.id)
      );
      const data = await res.json();
      expect(data).toHaveLength(2);
      expect(data.map((t: { title: string }) => t.title).sort()).toEqual([
        "Task 1",
        "Task 2",
      ]);
    });

    it("rejects duplicate link", async () => {
      const dispatch = await createDispatch("2025-06-15");
      const task = await createTask("My task");

      await LINK_TASK(
        jsonReq(`http://localhost/api/dispatches/${dispatch.id}/tasks`, "POST", {
          taskId: task.id,
        }),
        ctx(dispatch.id)
      );

      const res = await LINK_TASK(
        jsonReq(`http://localhost/api/dispatches/${dispatch.id}/tasks`, "POST", {
          taskId: task.id,
        }),
        ctx(dispatch.id)
      );
      expect(res.status).toBe(409);
    });

    it("rejects linking to nonexistent dispatch", async () => {
      const task = await createTask("My task");
      const res = await LINK_TASK(
        jsonReq("http://localhost/api/dispatches/nonexistent/tasks", "POST", {
          taskId: task.id,
        }),
        ctx("nonexistent")
      );
      expect(res.status).toBe(404);
    });

    it("rejects linking nonexistent task", async () => {
      const dispatch = await createDispatch("2025-06-15");
      const res = await LINK_TASK(
        jsonReq(`http://localhost/api/dispatches/${dispatch.id}/tasks`, "POST", {
          taskId: "nonexistent",
        }),
        ctx(dispatch.id)
      );
      expect(res.status).toBe(404);
    });

    it("rejects missing taskId", async () => {
      const dispatch = await createDispatch("2025-06-15");
      const res = await LINK_TASK(
        jsonReq(`http://localhost/api/dispatches/${dispatch.id}/tasks`, "POST", {}),
        ctx(dispatch.id)
      );
      expect(res.status).toBe(400);
    });

    it("rejects linking to a finalized dispatch", async () => {
      const dispatch = await createDispatch("2025-06-15");
      const task = await createTask("My task");

      // Finalize directly
      testDb.sqlite.exec(`UPDATE dispatch SET finalized = 1 WHERE id = '${dispatch.id}'`);

      const res = await LINK_TASK(
        jsonReq(`http://localhost/api/dispatches/${dispatch.id}/tasks`, "POST", {
          taskId: task.id,
        }),
        ctx(dispatch.id)
      );
      expect(res.status).toBe(400);
    });

    it("rejects linking another user's task", async () => {
      const dispatch = await createDispatch("2025-06-15");

      // Create task as other user
      mockSession({ user: OTHER_USER });
      const otherTask = await createTask("Other's task");

      // Try to link as test user
      mockSession({ user: TEST_USER });
      const res = await LINK_TASK(
        jsonReq(`http://localhost/api/dispatches/${dispatch.id}/tasks`, "POST", {
          taskId: otherTask.id,
        }),
        ctx(dispatch.id)
      );
      expect(res.status).toBe(404);
    });
  });

  // --- Unlink task ---

  describe("DELETE /api/dispatches/[id]/tasks (unlink)", () => {
    it("unlinks a task from a dispatch", async () => {
      const dispatch = await createDispatch("2025-06-15");
      const task = await createTask("My task");

      await LINK_TASK(
        jsonReq(`http://localhost/api/dispatches/${dispatch.id}/tasks`, "POST", {
          taskId: task.id,
        }),
        ctx(dispatch.id)
      );

      const res = await UNLINK_TASK(
        jsonReq(`http://localhost/api/dispatches/${dispatch.id}/tasks`, "DELETE", {
          taskId: task.id,
        }),
        ctx(dispatch.id)
      );
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ unlinked: true });

      // Verify it's no longer linked
      const listRes = await GET_DISPATCH_TASKS(
        new Request(`http://localhost/api/dispatches/${dispatch.id}/tasks`),
        ctx(dispatch.id)
      );
      const data = await listRes.json();
      expect(data).toHaveLength(0);
    });

    it("returns 404 for non-linked task", async () => {
      const dispatch = await createDispatch("2025-06-15");
      const task = await createTask("My task");

      const res = await UNLINK_TASK(
        jsonReq(`http://localhost/api/dispatches/${dispatch.id}/tasks`, "DELETE", {
          taskId: task.id,
        }),
        ctx(dispatch.id)
      );
      expect(res.status).toBe(404);
    });

    it("rejects unlinking from a finalized dispatch", async () => {
      const dispatch = await createDispatch("2025-06-15");
      const task = await createTask("My task");

      await LINK_TASK(
        jsonReq(`http://localhost/api/dispatches/${dispatch.id}/tasks`, "POST", {
          taskId: task.id,
        }),
        ctx(dispatch.id)
      );

      testDb.sqlite.exec(`UPDATE dispatch SET finalized = 1 WHERE id = '${dispatch.id}'`);

      const res = await UNLINK_TASK(
        jsonReq(`http://localhost/api/dispatches/${dispatch.id}/tasks`, "DELETE", {
          taskId: task.id,
        }),
        ctx(dispatch.id)
      );
      expect(res.status).toBe(400);
    });
  });
});

describe("Complete Day", () => {
  beforeEach(() => {
    testDb = createTestDb();
    testDb.db.insert(users).values(TEST_USER).run();
    mockSession({ user: TEST_USER });
  });

  it("finalizes a dispatch", async () => {
    const dispatch = await createDispatch("2025-06-15");

    const res = await COMPLETE_DAY(
      jsonReq(`http://localhost/api/dispatches/${dispatch.id}/complete`, "POST", {}),
      ctx(dispatch.id)
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.dispatch.finalized).toBe(true);
    expect(data.rolledOver).toBe(0);
    expect(data.nextDispatchId).toBeNull();
  });

  it("rejects completing an already finalized dispatch", async () => {
    const dispatch = await createDispatch("2025-06-15");

    await COMPLETE_DAY(
      jsonReq(`http://localhost/api/dispatches/${dispatch.id}/complete`, "POST", {}),
      ctx(dispatch.id)
    );

    const res = await COMPLETE_DAY(
      jsonReq(`http://localhost/api/dispatches/${dispatch.id}/complete`, "POST", {}),
      ctx(dispatch.id)
    );
    expect(res.status).toBe(400);
  });

  it("rolls unfinished tasks to the next day", async () => {
    const dispatch = await createDispatch("2025-06-15");
    const openTask = await createTask("Open task", { status: "open" });
    const inProgressTask = await createTask("In progress", { status: "in_progress" });
    const doneTask = await createTask("Done task", { status: "done" });

    // Link all three tasks
    for (const task of [openTask, inProgressTask, doneTask]) {
      await LINK_TASK(
        jsonReq(`http://localhost/api/dispatches/${dispatch.id}/tasks`, "POST", {
          taskId: task.id,
        }),
        ctx(dispatch.id)
      );
    }

    const res = await COMPLETE_DAY(
      jsonReq(`http://localhost/api/dispatches/${dispatch.id}/complete`, "POST", {}),
      ctx(dispatch.id)
    );
    const data = await res.json();
    expect(data.rolledOver).toBe(2); // open + in_progress
    expect(data.nextDispatchId).toBeDefined();

    // Verify next day's dispatch has the unfinished tasks
    const nextTasks = await GET_DISPATCH_TASKS(
      new Request(`http://localhost/api/dispatches/${data.nextDispatchId}/tasks`),
      ctx(data.nextDispatchId)
    );
    const nextTaskData = await nextTasks.json();
    expect(nextTaskData).toHaveLength(2);
    expect(
      nextTaskData.map((t: { title: string }) => t.title).sort()
    ).toEqual(["In progress", "Open task"]);
  });

  it("applies dispatch template when rollover creates the next day", async () => {
    testDb.db
      .insert(notes)
      .values({
        id: "note-template-rollover",
        userId: TEST_USER.id,
        title: "TasklistTemplate",
        content: [
          "{{if:day=mon}}",
          "- [ ] Monday kickoff >{{date:YYYY-MM-DD}}",
          "{{endif}}",
        ].join("\n"),
      })
      .run();

    const dispatch = await createDispatch("2025-06-15"); // Sunday
    const openTask = await createTask("Carry over");

    await LINK_TASK(
      jsonReq(`http://localhost/api/dispatches/${dispatch.id}/tasks`, "POST", {
        taskId: openTask.id,
      }),
      ctx(dispatch.id),
    );

    const res = await COMPLETE_DAY(
      jsonReq(`http://localhost/api/dispatches/${dispatch.id}/complete`, "POST", {}),
      ctx(dispatch.id),
    );
    const data = await res.json();

    const nextTasks = await GET_DISPATCH_TASKS(
      new Request(`http://localhost/api/dispatches/${data.nextDispatchId}/tasks`),
      ctx(data.nextDispatchId),
    );
    const nextTaskData = await nextTasks.json();
    expect(nextTaskData.map((t: { title: string }) => t.title).sort()).toEqual([
      "Carry over",
      "Monday kickoff",
    ]);

    const kickoff = nextTaskData.find((t: { title: string }) => t.title === "Monday kickoff");
    expect(kickoff.dueDate).toBe("2025-06-16");
  });

  it("creates next day dispatch with correct date", async () => {
    const dispatch = await createDispatch("2025-06-15");
    const task = await createTask("Carry over");

    await LINK_TASK(
      jsonReq(`http://localhost/api/dispatches/${dispatch.id}/tasks`, "POST", {
        taskId: task.id,
      }),
      ctx(dispatch.id)
    );

    const res = await COMPLETE_DAY(
      jsonReq(`http://localhost/api/dispatches/${dispatch.id}/complete`, "POST", {}),
      ctx(dispatch.id)
    );
    const data = await res.json();

    // Verify next dispatch date
    const nextRes = await GET_DISPATCH(
      new Request(`http://localhost/api/dispatches/${data.nextDispatchId}`),
      ctx(data.nextDispatchId)
    );
    const nextDispatch = await nextRes.json();
    expect(nextDispatch.date).toBe("2025-06-16");
  });

  it("uses existing next-day dispatch if one exists", async () => {
    const dispatch = await createDispatch("2025-06-15");
    const nextDayDispatch = await createDispatch("2025-06-16");
    const task = await createTask("Carry over");

    await LINK_TASK(
      jsonReq(`http://localhost/api/dispatches/${dispatch.id}/tasks`, "POST", {
        taskId: task.id,
      }),
      ctx(dispatch.id)
    );

    const res = await COMPLETE_DAY(
      jsonReq(`http://localhost/api/dispatches/${dispatch.id}/complete`, "POST", {}),
      ctx(dispatch.id)
    );
    const data = await res.json();
    expect(data.nextDispatchId).toBe(nextDayDispatch.id);
  });

  it("does not duplicate tasks already linked to next day", async () => {
    const dispatch = await createDispatch("2025-06-15");
    const nextDayDispatch = await createDispatch("2025-06-16");
    const task = await createTask("Shared task");

    // Link task to both dispatches
    await LINK_TASK(
      jsonReq(`http://localhost/api/dispatches/${dispatch.id}/tasks`, "POST", {
        taskId: task.id,
      }),
      ctx(dispatch.id)
    );
    await LINK_TASK(
      jsonReq(`http://localhost/api/dispatches/${nextDayDispatch.id}/tasks`, "POST", {
        taskId: task.id,
      }),
      ctx(nextDayDispatch.id)
    );

    const res = await COMPLETE_DAY(
      jsonReq(`http://localhost/api/dispatches/${dispatch.id}/complete`, "POST", {}),
      ctx(dispatch.id)
    );
    expect(res.status).toBe(200);

    // Verify no duplicate
    const nextTasks = await GET_DISPATCH_TASKS(
      new Request(`http://localhost/api/dispatches/${nextDayDispatch.id}/tasks`),
      ctx(nextDayDispatch.id)
    );
    const nextTaskData = await nextTasks.json();
    expect(nextTaskData).toHaveLength(1);
  });

  it("returns 404 for nonexistent dispatch", async () => {
    const res = await COMPLETE_DAY(
      jsonReq("http://localhost/api/dispatches/nonexistent/complete", "POST", {}),
      ctx("nonexistent")
    );
    expect(res.status).toBe(404);
  });
});
