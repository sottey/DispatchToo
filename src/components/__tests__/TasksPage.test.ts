import { describe, expect, it } from "vitest";
import { applyCompletedVisibility, applyTodayFocusScope } from "@/components/TasksPage";
import type { Task } from "@/lib/client";

const BASE_TASK: Omit<Task, "id" | "title" | "status" | "dueDate"> = {
  userId: "user-1",
  projectId: null,
  description: null,
  priority: "medium",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function task(overrides: Partial<Task> & Pick<Task, "id" | "title" | "status" | "dueDate">): Task {
  return {
    ...BASE_TASK,
    ...overrides,
  };
}

describe("TasksPage task scoping", () => {
  it("filters today-focus to due today and overdue, excluding future and undated", () => {
    const tasks = [
      task({ id: "t-overdue", title: "Overdue", status: "open", dueDate: "2026-02-10" }),
      task({ id: "t-today", title: "Today", status: "open", dueDate: "2026-02-19" }),
      task({ id: "t-future", title: "Future", status: "open", dueDate: "2026-02-20" }),
      task({ id: "t-none", title: "No due date", status: "open", dueDate: null }),
    ];

    const scoped = applyTodayFocusScope(tasks, true, "2026-02-19");
    expect(scoped.map((item) => item.id)).toEqual(["t-overdue", "t-today"]);
  });

  it("returns all tasks when today-focus is off", () => {
    const tasks = [
      task({ id: "t1", title: "A", status: "open", dueDate: null }),
      task({ id: "t2", title: "B", status: "done", dueDate: "2026-02-20" }),
    ];

    const scoped = applyTodayFocusScope(tasks, false, "2026-02-19");
    expect(scoped).toEqual(tasks);
  });

  it("hides done tasks unless showCompleted is on or the row is animating completion", () => {
    const tasks = [
      task({ id: "open-1", title: "Open", status: "open", dueDate: null }),
      task({ id: "done-hidden", title: "Done Hidden", status: "done", dueDate: null }),
      task({ id: "done-visible", title: "Done Visible", status: "done", dueDate: null }),
    ];

    const hidden = applyCompletedVisibility(tasks, false, ["done-visible"]);
    expect(hidden.map((item) => item.id)).toEqual(["open-1", "done-visible"]);

    const allVisible = applyCompletedVisibility(tasks, true, []);
    expect(allVisible.map((item) => item.id)).toEqual(["open-1", "done-hidden", "done-visible"]);
  });
});
