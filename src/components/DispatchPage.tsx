"use client";

import { useEffect, useState, useCallback } from "react";
import {
  api,
  type Dispatch,
  type Task,
  type TaskStatus,
} from "@/lib/client";
import { useToast } from "@/components/ToastProvider";

const STATUS_STYLES: Record<TaskStatus, { dot: string; label: string }> = {
  open: { dot: "bg-blue-500", label: "Open" },
  in_progress: { dot: "bg-yellow-500", label: "In Progress" },
  done: { dot: "bg-green-500", label: "Done" },
};

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

export function DispatchPage() {
  const { toast } = useToast();
  const [date, setDate] = useState(todayStr);
  const [dispatch, setDispatch] = useState<Dispatch | null>(null);
  const [linkedTasks, setLinkedTasks] = useState<Task[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState("");
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);

  const fetchDispatch = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.dispatches.list(date);
      let d = list[0] ?? null;

      if (!d) {
        d = await api.dispatches.create({ date });
      }

      setDispatch(d);
      setSummary(d.summary ?? "");

      const tasks = await api.dispatches.getTasks(d.id);
      setLinkedTasks(tasks);

      const all = await api.tasks.list();
      setAllTasks(all);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchDispatch();
  }, [fetchDispatch]);

  async function handleSaveSummary() {
    if (!dispatch) return;
    setSaving(true);
    try {
      const updated = await api.dispatches.update(dispatch.id, { summary });
      setDispatch(updated);
      toast.success("Summary saved");
    } catch {
      toast.error("Failed to save summary");
    } finally {
      setSaving(false);
    }
  }

  async function handleLinkTask(taskId: string) {
    if (!dispatch) return;
    try {
      await api.dispatches.linkTask(dispatch.id, taskId);
      fetchDispatch();
    } catch {
      toast.error("Failed to link task");
    }
  }

  async function handleUnlinkTask(taskId: string) {
    if (!dispatch) return;
    setLinkedTasks((prev) => prev.filter((t) => t.id !== taskId));
    try {
      await api.dispatches.unlinkTask(dispatch.id, taskId);
    } catch {
      fetchDispatch();
      toast.error("Failed to remove task");
    }
  }

  async function handleStatusToggle(task: Task) {
    const next: TaskStatus =
      task.status === "open"
        ? "in_progress"
        : task.status === "in_progress"
          ? "done"
          : "open";

    setLinkedTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: next } : t)),
    );

    try {
      await api.tasks.update(task.id, { status: next });
    } catch {
      fetchDispatch();
      toast.error("Failed to update task status");
    }
  }

  async function handleComplete() {
    if (!dispatch) return;
    setCompleting(true);
    try {
      const result = await api.dispatches.complete(dispatch.id);
      setDispatch(result.dispatch);
      toast.success("Day completed!");
      if (result.nextDispatchId) {
        const nextDate = new Date(date + "T00:00:00");
        nextDate.setDate(nextDate.getDate() + 1);
        setDate(nextDate.toISOString().split("T")[0]);
      } else {
        fetchDispatch();
      }
    } catch {
      toast.error("Failed to complete day");
    } finally {
      setCompleting(false);
    }
  }

  function navigateDay(offset: number) {
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() + offset);
    setDate(d.toISOString().split("T")[0]);
  }

  const isToday = date === todayStr();

  const linkedIds = new Set(linkedTasks.map((t) => t.id));
  const availableTasks = allTasks.filter(
    (t) => !linkedIds.has(t.id) && t.status !== "done",
  );

  const overdueTasks = linkedTasks.filter(
    (t) => t.dueDate && t.dueDate < date && t.status !== "done",
  );
  const dueTodayTasks = linkedTasks.filter(
    (t) => t.dueDate === date && t.status !== "done",
  );
  const otherTasks = linkedTasks.filter(
    (t) =>
      !overdueTasks.includes(t) &&
      !dueTodayTasks.includes(t),
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-32 rounded-lg bg-gray-200 dark:bg-gray-700" />
          <div className="h-48 rounded-lg bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      {/* Header with date navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigateDay(-1)}
            className="rounded-lg border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300 transition-colors"
          >
            &larr;
          </button>
          <div>
            <h1 className="text-2xl font-bold dark:text-white">
              {isToday ? "Today's Dispatch" : "Dispatch"}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {new Date(date + "T00:00:00").toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <button
            onClick={() => navigateDay(1)}
            className="rounded-lg border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300 transition-colors"
          >
            &rarr;
          </button>
          {!isToday && (
            <button
              onClick={() => setDate(todayStr())}
              className="rounded-lg bg-gray-100 dark:bg-gray-700 px-3 py-1 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 dark:text-gray-200 transition-colors"
            >
              Today
            </button>
          )}
        </div>

        {dispatch?.finalized && (
          <span className="rounded-full bg-green-100 dark:bg-green-900/40 px-3 py-1 text-sm font-medium text-green-700 dark:text-green-300">
            Finalized
          </span>
        )}
      </div>

      {/* Summary */}
      <section className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Daily Summary</h2>
        {dispatch?.finalized ? (
          <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
            {dispatch.summary || "No summary written."}
          </p>
        ) : (
          <>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Write your daily summary, goals, or notes…"
              rows={4}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm dark:text-white focus:border-gray-900 dark:focus:border-gray-400 focus:outline-none resize-none"
            />
            <div className="flex justify-end">
              <button
                onClick={handleSaveSummary}
                disabled={saving}
                className="rounded-lg bg-gray-900 dark:bg-gray-100 px-4 py-1.5 text-sm font-medium text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving…" : "Save Summary"}
              </button>
            </div>
          </>
        )}
      </section>

      {/* Linked tasks */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold dark:text-white">Tasks</h2>
          <span className="text-sm text-gray-400 dark:text-gray-500">
            {linkedTasks.filter((t) => t.status === "done").length}/{linkedTasks.length} done
          </span>
        </div>

        {overdueTasks.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-red-600 dark:text-red-400 uppercase tracking-wide">Overdue</p>
            <ul className="space-y-2">
              {overdueTasks.map((task) => (
                <LinkedTaskRow
                  key={task.id}
                  task={task}
                  finalized={dispatch?.finalized ?? false}
                  onStatusToggle={() => handleStatusToggle(task)}
                  onUnlink={() => handleUnlinkTask(task.id)}
                />
              ))}
            </ul>
          </div>
        )}

        {dueTodayTasks.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-yellow-600 dark:text-yellow-400 uppercase tracking-wide">Due Today</p>
            <ul className="space-y-2">
              {dueTodayTasks.map((task) => (
                <LinkedTaskRow
                  key={task.id}
                  task={task}
                  finalized={dispatch?.finalized ?? false}
                  onStatusToggle={() => handleStatusToggle(task)}
                  onUnlink={() => handleUnlinkTask(task.id)}
                />
              ))}
            </ul>
          </div>
        )}

        {otherTasks.length > 0 && (
          <ul className="space-y-2">
            {otherTasks.map((task) => (
              <LinkedTaskRow
                key={task.id}
                task={task}
                finalized={dispatch?.finalized ?? false}
                onStatusToggle={() => handleStatusToggle(task)}
                onUnlink={() => handleUnlinkTask(task.id)}
              />
            ))}
          </ul>
        )}

        {linkedTasks.length === 0 && (
          <p className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">
            No tasks linked to this dispatch yet.
          </p>
        )}
      </section>

      {/* Add task picker */}
      {!dispatch?.finalized && availableTasks.length > 0 && (
        <section className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-4 space-y-2">
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Link a task</h3>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {availableTasks.map((task) => (
              <button
                key={task.id}
                onClick={() => handleLinkTask(task.id)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300 transition-colors"
              >
                <span
                  className={`block h-2.5 w-2.5 rounded-full flex-shrink-0 ${STATUS_STYLES[task.status].dot}`}
                />
                <span className="flex-1 truncate">{task.title}</span>
                {task.dueDate && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">{task.dueDate}</span>
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Complete day button */}
      {dispatch && !dispatch.finalized && (
        <div className="flex justify-end pt-2">
          <button
            onClick={handleComplete}
            disabled={completing}
            className="rounded-lg bg-green-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {completing ? "Completing…" : "Complete Day"}
          </button>
        </div>
      )}
    </div>
  );
}

// ---- Sub-components ----

function LinkedTaskRow({
  task,
  finalized,
  onStatusToggle,
  onUnlink,
}: {
  task: Task;
  finalized: boolean;
  onStatusToggle: () => void;
  onUnlink: () => void;
}) {
  return (
    <li
      className={`flex items-center gap-3 rounded-lg border bg-white dark:bg-gray-800 p-3 transition-colors ${
        task.status === "done"
          ? "border-gray-100 dark:border-gray-700 opacity-60"
          : "border-gray-200 dark:border-gray-700"
      }`}
    >
      <button
        onClick={onStatusToggle}
        disabled={finalized}
        title={`Status: ${STATUS_STYLES[task.status].label} (click to cycle)`}
        className="flex-shrink-0 disabled:cursor-default"
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

      {task.dueDate && (
        <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
          {task.dueDate}
        </span>
      )}

      {!finalized && (
        <button
          onClick={onUnlink}
          className="text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
          title="Remove from dispatch"
        >
          Remove
        </button>
      )}
    </li>
  );
}
