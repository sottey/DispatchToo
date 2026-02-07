"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type Task, type Note } from "@/lib/client";

export function Dashboard({ userName }: { userName: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.tasks.list(), api.notes.list()])
      .then(([t, n]) => {
        setTasks(Array.isArray(t) ? t : t.data);
        setNotes(Array.isArray(n) ? n : n.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const openTasks = tasks.filter((t) => t.status === "open");
  const inProgressTasks = tasks.filter((t) => t.status === "in_progress");
  const doneTasks = tasks.filter((t) => t.status === "done");

  const today = new Date().toISOString().split("T")[0];
  const overdue = tasks.filter(
    (t) => t.dueDate && t.dueDate < today && t.status !== "done",
  );
  const dueToday = tasks.filter(
    (t) => t.dueDate?.startsWith(today) && t.status !== "done",
  );
  const upcoming = tasks
    .filter((t) => t.dueDate && t.dueDate > today && t.status !== "done")
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))
    .slice(0, 5);

  const recentNotes = [...notes]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 5);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-lg bg-gray-200 dark:bg-gray-700" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold dark:text-white">Dashboard</h1>
        <p className="mt-1 text-gray-500 dark:text-gray-400">Welcome back, {userName}.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Open" count={openTasks.length} color="blue" href="/tasks?status=open" />
        <StatCard label="In Progress" count={inProgressTasks.length} color="yellow" href="/tasks?status=in_progress" />
        <StatCard label="Done" count={doneTasks.length} color="green" href="/tasks?status=done" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Due dates */}
        <section>
          <h2 className="text-lg font-semibold mb-3 dark:text-white">Upcoming</h2>
          {overdue.length === 0 && dueToday.length === 0 && upcoming.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">No upcoming deadlines.</p>
          ) : (
            <ul className="space-y-2">
              {overdue.map((t) => (
                <DueItem key={t.id} task={t} badge="Overdue" badgeColor="red" />
              ))}
              {dueToday.map((t) => (
                <DueItem key={t.id} task={t} badge="Today" badgeColor="yellow" />
              ))}
              {upcoming.map((t) => (
                <DueItem key={t.id} task={t} />
              ))}
            </ul>
          )}
        </section>

        {/* Recent notes */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold dark:text-white">Recent Notes</h2>
            <Link href="/notes" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
              View all
            </Link>
          </div>
          {recentNotes.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">No notes yet.</p>
          ) : (
            <ul className="space-y-2">
              {recentNotes.map((n) => (
                <li key={n.id}>
                  <Link
                    href={`/notes/${n.id}`}
                    className="block rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                  >
                    <p className="font-medium text-sm truncate dark:text-white">{n.title}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {new Date(n.updatedAt).toLocaleDateString()}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({
  label,
  count,
  color,
  href,
}: {
  label: string;
  count: number;
  color: "blue" | "yellow" | "green";
  href: string;
}) {
  const colors = {
    blue: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
    yellow: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800",
    green: "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800",
  };
  return (
    <Link
      href={href}
      className={`rounded-lg border p-4 ${colors[color]} hover:opacity-80 transition-opacity`}
    >
      <p className="text-3xl font-bold">{count}</p>
      <p className="text-sm font-medium mt-1">{label}</p>
    </Link>
  );
}

function DueItem({
  task,
  badge,
  badgeColor,
}: {
  task: Task;
  badge?: string;
  badgeColor?: "red" | "yellow";
}) {
  const badgeColors = {
    red: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    yellow: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  };
  return (
    <li className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate dark:text-white">{task.title}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Due {task.dueDate}
        </p>
      </div>
      {badge && badgeColor && (
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badgeColors[badgeColor]}`}>
          {badge}
        </span>
      )}
    </li>
  );
}
