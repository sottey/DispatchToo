"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  api,
  type Task,
  type TaskStatus,
  type TaskPriority,
  type Project,
} from "@/lib/client";
import { PROJECT_COLORS } from "@/lib/projects";
import { CustomSelect } from "@/components/CustomSelect";

export function TaskModal({
  task,
  defaultProjectId,
  defaultDueDate,
  onClose,
  onSaved,
}: {
  task: Task | null;
  defaultProjectId?: string;
  defaultDueDate?: string;
  onClose: () => void;
  onSaved: (task: Task) => void;
}) {
  const isEditing = task !== null;

  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? "open");
  const [priority, setPriority] = useState<TaskPriority>(
    task?.priority ?? "medium",
  );
  const [dueDate, setDueDate] = useState(task?.dueDate ?? defaultDueDate ?? "");
  const [projectId, setProjectId] = useState(
    task?.projectId ?? defaultProjectId ?? "",
  );
  const [projects, setProjects] = useState<Project[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    let active = true;
    api.projects.list().then((data) => {
      if (!active) return;
      setProjects(Array.isArray(data) ? data : data.data);
    });
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      let savedTask: Task;
      if (isEditing) {
        savedTask = await api.tasks.update(task.id, {
          title: title.trim(),
          description: description || undefined,
          status,
          priority,
          dueDate: dueDate || null,
          projectId: projectId || null,
        });
      } else {
        savedTask = await api.tasks.create({
          title: title.trim(),
          description: description || undefined,
          status,
          priority,
          dueDate: dueDate || undefined,
          projectId: projectId || null,
        });
      }
      onSaved(savedTask);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save task");
    } finally {
      setSaving(false);
    }
  }

  const statusOptions = [
    { value: "open", label: "Open", dot: "bg-blue-500" },
    { value: "in_progress", label: "In Progress", dot: "bg-yellow-500" },
    { value: "done", label: "Done", dot: "bg-green-500" },
  ];

  const priorityOptions = [
    { value: "low", label: "Low", dot: "bg-neutral-400" },
    { value: "medium", label: "Medium", dot: "bg-yellow-500" },
    { value: "high", label: "High", dot: "bg-red-500" },
  ];

  const projectOptions = [
    { value: "", label: "No Project", dot: "bg-neutral-300" },
    ...projects
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((project) => ({
        value: project.id,
        label: project.name,
        dot: PROJECT_COLORS[project.color]?.dot ?? "bg-neutral-400",
      })),
  ];

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto px-4 py-8 sm:py-12">
      <div
        className="absolute inset-0 bg-black/40 animate-backdrop-enter"
        onClick={onClose}
      />

      <form
        onSubmit={handleSubmit}
        className="relative my-auto w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl dark:bg-neutral-900 space-y-4 animate-modal-enter"
      >
        <h2 className="text-lg font-semibold dark:text-white">
          {isEditing ? "Edit Task" : "New Task"}
        </h2>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm dark:text-white focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none transition-colors"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm dark:text-white focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none resize-none transition-colors"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <PillGroup
            label="Status"
            value={status}
            options={statusOptions}
            onChange={(v) => setStatus(v as TaskStatus)}
          />

          <PillGroup
            label="Priority"
            value={priority}
            options={priorityOptions}
            onChange={(v) => setPriority(v as TaskPriority)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[0.8fr_1.2fr] gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
              Due Date
            </p>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-2 w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm dark:text-white focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none transition-colors"
            />
          </div>

          <CustomSelect
            label="Project"
            value={projectId}
            onChange={(v: string) => setProjectId(v)}
            options={projectOptions}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 active:scale-95 transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-neutral-900 dark:bg-neutral-100 px-4 py-2 text-sm font-medium text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 disabled:opacity-50 active:scale-95 transition-all inline-flex items-center gap-2"
          >
            {saving && (
              <span className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spinner" />
            )}
            {saving ? "Saving..." : isEditing ? "Update" : "Create"}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

type PillOption = { value: string; label: string; dot?: string };

function PillGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: PillOption[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
        {label}
      </p>
      <div className="mt-2 flex flex-nowrap gap-2 overflow-x-auto">
        {options.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={`${label}-${option.value}`}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={active}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                active
                  ? "border-neutral-900 bg-neutral-900 text-white shadow-sm dark:border-white dark:bg-white dark:text-neutral-900"
                  : "border-neutral-200 bg-white/80 text-neutral-600 hover:text-neutral-900 hover:border-neutral-300 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:text-white dark:hover:border-neutral-500"
              }`}
            >
              {option.dot && <span className={`h-2.5 w-2.5 rounded-full ${option.dot}`} />}
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
