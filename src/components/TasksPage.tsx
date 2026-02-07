"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  api,
  type Task,
  type TaskStatus,
  type TaskPriority,
} from "@/lib/client";
import { TaskModal } from "@/components/TaskModal";
import { Pagination } from "@/components/Pagination";
import { useToast } from "@/components/ToastProvider";

type SortField = "createdAt" | "dueDate" | "priority";

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export function TasksPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "">(
    (searchParams.get("status") as TaskStatus) || "",
  );
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | "">(
    (searchParams.get("priority") as TaskPriority) || "",
  );
  const [sortBy, setSortBy] = useState<SortField>("createdAt");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.tasks.list({
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        page,
        limit: 20,
      });
      if (Array.isArray(data)) {
        setTasks(data);
        setTotalPages(1);
      } else {
        setTasks(data.data);
        setTotalPages(data.pagination.totalPages);
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter, page]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Listen for keyboard shortcut to create new task
  useEffect(() => {
    function handleNewTask() {
      setEditingTask(null);
      setModalOpen(true);
    }
    window.addEventListener("shortcut:new-task", handleNewTask);
    return () => window.removeEventListener("shortcut:new-task", handleNewTask);
  }, []);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, priorityFilter]);

  // Update URL params when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (priorityFilter) params.set("priority", priorityFilter);
    const qs = params.toString();
    router.replace(`/tasks${qs ? "?" + qs : ""}`, { scroll: false });
  }, [statusFilter, priorityFilter, router]);

  const sorted = [...tasks].sort((a, b) => {
    if (sortBy === "dueDate") {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    }
    if (sortBy === "priority") {
      return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    }
    return b.createdAt.localeCompare(a.createdAt);
  });

  async function handleStatusToggle(task: Task) {
    const next: TaskStatus =
      task.status === "open"
        ? "in_progress"
        : task.status === "in_progress"
          ? "done"
          : "open";

    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: next } : t)),
    );

    try {
      await api.tasks.update(task.id, { status: next });
    } catch {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, status: task.status } : t,
        ),
      );
      toast.error("Failed to update task status");
    }
  }

  async function handleDelete(id: string) {
    const prev = tasks;
    setTasks((t) => t.filter((x) => x.id !== id));
    try {
      await api.tasks.delete(id);
      toast.success("Task deleted");
    } catch {
      setTasks(prev);
      toast.error("Failed to delete task");
    }
  }

  function handleSaved() {
    setModalOpen(false);
    setEditingTask(null);
    fetchTasks();
    toast.success("Task saved");
  }

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold dark:text-white">Tasks</h1>
        <button
          onClick={() => {
            setEditingTask(null);
            setModalOpen(true);
          }}
          className="rounded-lg bg-gray-900 dark:bg-gray-100 px-4 py-2 text-sm font-medium text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
        >
          New Task
        </button>
      </div>

      {/* Filters & sort */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as TaskStatus | "")}
          className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm dark:text-gray-200"
        >
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
        </select>

        <select
          value={priorityFilter}
          onChange={(e) =>
            setPriorityFilter(e.target.value as TaskPriority | "")
          }
          className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm dark:text-gray-200"
        >
          <option value="">All priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <div className="ml-auto flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <span>Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortField)}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm dark:text-gray-200"
          >
            <option value="createdAt">Newest</option>
            <option value="dueDate">Due Date</option>
            <option value="priority">Priority</option>
          </select>
        </div>
      </div>

      {/* Task list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700"
            />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-12 text-center text-gray-400 dark:text-gray-500">
          No tasks found.{" "}
          <button
            onClick={() => {
              setEditingTask(null);
              setModalOpen(true);
            }}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            Create one
          </button>
        </div>
      ) : (
        <ul className="space-y-2">
          {sorted.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onStatusToggle={() => handleStatusToggle(task)}
              onEdit={() => {
                setEditingTask(task);
                setModalOpen(true);
              }}
              onDelete={() => handleDelete(task.id)}
            />
          ))}
        </ul>
      )}

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      {modalOpen && (
        <TaskModal
          task={editingTask}
          onClose={() => {
            setModalOpen(false);
            setEditingTask(null);
          }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

// ---- Sub-components ----

const STATUS_STYLES: Record<TaskStatus, { dot: string; label: string }> = {
  open: { dot: "bg-blue-500", label: "Open" },
  in_progress: { dot: "bg-yellow-500", label: "In Progress" },
  done: { dot: "bg-green-500", label: "Done" },
};

const PRIORITY_BADGE: Record<TaskPriority, string> = {
  high: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  low: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
};

function TaskRow({
  task,
  onStatusToggle,
  onEdit,
  onDelete,
}: {
  task: Task;
  onStatusToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li
      className={`flex items-center gap-3 rounded-lg border bg-white dark:bg-gray-800 p-4 transition-colors ${
        task.status === "done"
          ? "border-gray-100 dark:border-gray-700 opacity-60"
          : "border-gray-200 dark:border-gray-700"
      }`}
    >
      <button
        onClick={onStatusToggle}
        title={`Status: ${STATUS_STYLES[task.status].label} (click to cycle)`}
        className="flex-shrink-0"
      >
        <span
          className={`block h-3 w-3 rounded-full ${STATUS_STYLES[task.status].dot}`}
        />
      </button>

      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium truncate dark:text-white ${task.status === "done" ? "line-through" : ""}`}
        >
          {task.title}
        </p>
        {task.description && (
          <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
            {task.description}
          </p>
        )}
      </div>

      <span
        className={`text-xs font-medium px-2 py-0.5 rounded-full ${PRIORITY_BADGE[task.priority]}`}
      >
        {task.priority}
      </span>

      {task.dueDate && (
        <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
          {task.dueDate}
        </span>
      )}

      <button
        onClick={onEdit}
        className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
      >
        Edit
      </button>
      <button
        onClick={onDelete}
        className="text-xs text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors"
      >
        Delete
      </button>
    </li>
  );
}
