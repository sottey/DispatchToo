"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type Task, type Note, type TaskStatus, type ProjectWithStats } from "@/lib/client";
import { PROJECT_COLORS } from "@/lib/projects";
import {
  IconDocument,
  IconCalendar,
  IconSearch,
  IconList,
} from "@/components/icons";

const STATUS_BADGES: Record<TaskStatus, string> = {
  open: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  in_progress: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  done: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
};

export function Dashboard({ userName }: { userName: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [dispatchCount, setDispatchCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showSkeleton, setShowSkeleton] = useState(false);

  useEffect(() => {
    if (!loading) {
      setShowSkeleton(false);
      return;
    }
    const timer = setTimeout(() => setShowSkeleton(true), 120);
    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.tasks.list(),
      api.notes.list(),
      api.dispatches.list({ page: 1, limit: 1 }),
      api.projects.listWithStats({ status: "active" }),
    ])
      .then(([t, n, d, p]) => {
        if (!active) return;
        setTasks(Array.isArray(t) ? t : t.data);
        setNotes(Array.isArray(n) ? n : n.data);
        if (Array.isArray(d)) {
          setDispatchCount(d.length);
        } else {
          setDispatchCount(d.pagination.total);
        }
        setProjects(Array.isArray(p) ? p : p.data);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const openTasks = tasks.filter((t) => t.status === "open");
  const inProgressTasks = tasks.filter((t) => t.status === "in_progress");
  const today = new Date().toISOString().split("T")[0];
  const focusWindowDays = 7;
  const focusEnd = new Date();
  focusEnd.setDate(focusEnd.getDate() + focusWindowDays);
  const focusEndIso = focusEnd.toISOString().split("T")[0];
  const overdue = tasks.filter(
    (t) => t.dueDate && t.dueDate < today && t.status !== "done",
  );
  const dueToday = tasks.filter(
    (t) => t.dueDate?.startsWith(today) && t.status !== "done",
  );
  const dueSoon = tasks.filter(
    (t) => t.dueDate && t.dueDate > today && t.dueDate <= focusEndIso && t.status !== "done",
  );
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  const weekStartTime = weekStart.getTime();
  const notesThisWeek = notes.filter(
    (n) => new Date(n.updatedAt).getTime() >= weekStartTime,
  ).length;
  const upcoming = tasks
    .filter((t) => t.dueDate && t.dueDate > today && t.status !== "done")
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))
    .slice(0, 5);

  const recentNotes = [...notes]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 5);

  type ActivityItem = {
    id: string;
    type: "task" | "note";
    title: string;
    date: string;
    status?: TaskStatus;
  };

  const recentActivity: ActivityItem[] = [
    ...tasks.map((t) => ({
      id: `task-${t.id}`,
      type: "task" as const,
      title: t.title,
      date: t.updatedAt,
      status: t.status,
    })),
    ...notes.map((n) => ({
      id: `note-${n.id}`,
      type: "note" as const,
      title: n.title,
      date: n.updatedAt,
    })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);

  const projectMap = new Map(projects.map((project) => [project.id, project]));

  const topProjects = [...projects]
    .filter((project) => project.stats.total > 0)
    .sort((a, b) => b.stats.total - a.stats.total)
    .slice(0, 3);

  const recentProjectActivity = [...tasks]
    .filter((task) => Boolean(task.projectId))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 4)
    .map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      projectName: projectMap.get(task.projectId || "")?.name ?? "Project",
      updatedAt: task.updatedAt,
    }));

  // Deadline focus calculation (next 7 days)
  const focusTasks = tasks.filter((t) => t.dueDate && t.dueDate <= focusEndIso);
  const focusDone = focusTasks.filter((t) => t.status === "done");
  const focusPercent = focusTasks.length > 0 ? Math.round((focusDone.length / focusTasks.length) * 100) : 100;
  const focusLabel = focusTasks.length > 0 ? `${focusDone.length}/${focusTasks.length}` : "Clear";
  const focusHeadline = focusTasks.length > 0 ? `${focusPercent}%` : "All clear";
  const focusSubtext = focusTasks.length > 0
    ? `Resolved ${focusDone.length} of ${focusTasks.length} due in next ${focusWindowDays} days`
    : `No tasks due in next ${focusWindowDays} days`;
  const focusTone =
    overdue.length > 0
      ? "text-red-500 dark:text-red-400"
      : dueToday.length > 0
        ? "text-amber-500 dark:text-amber-400"
        : dueSoon.length > 0
          ? "text-emerald-500 dark:text-emerald-400"
          : "text-neutral-400 dark:text-neutral-500";

  if (loading && showSkeleton) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div className="space-y-6">
          <div className="h-8 w-48 rounded skeleton-shimmer" />
          {/* Quick Actions skeleton */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 rounded-xl skeleton-shimmer" />
            ))}
          </div>
          {/* Stat cards skeleton */}
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-xl skeleton-shimmer" />
            ))}
          </div>
          {/* KPI strip skeleton */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-16 rounded-xl skeleton-shimmer" />
            ))}
          </div>
          {/* Content skeleton */}
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-3">
              <div className="h-5 w-24 rounded skeleton-shimmer" />
              <div className="h-16 rounded-lg skeleton-shimmer" />
              <div className="h-16 rounded-lg skeleton-shimmer" />
            </div>
            <div className="space-y-3">
              <div className="h-5 w-28 rounded skeleton-shimmer" />
              <div className="h-16 rounded-lg skeleton-shimmer" />
              <div className="h-16 rounded-lg skeleton-shimmer" />
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (loading) {
    return <div className="mx-auto max-w-5xl p-6" />;
  }

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-8">
      <div className="animate-fade-in-up">
        <h1 className="text-2xl font-bold dark:text-white">Dashboard</h1>
        <p className="mt-1 text-neutral-500 dark:text-neutral-400">Welcome back, {userName}.</p>
      </div>

      {/* Search */}
      <div className="flex justify-end animate-fade-in-up" style={{ animationDelay: "50ms" }}>
        <button
          onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }))}
          className="group relative flex items-center gap-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-gradient-to-br from-neutral-50 to-white dark:from-neutral-900/50 dark:to-neutral-900 text-neutral-700 dark:text-neutral-300 px-4 py-2.5 text-sm font-medium transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg active:scale-95 w-72"
        >
          <span
            className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full bg-gradient-to-br from-neutral-200/70 via-transparent to-transparent dark:from-neutral-500/10 opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
          />
          <IconSearch className="w-5 h-5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-105" />
          <span>Search</span>
          <span className="ml-auto text-xs text-neutral-400 dark:text-neutral-500 font-mono">Ctrl+K</span>
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
        <Link
          href="/tasks"
          className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 dark:from-blue-600 dark:via-blue-700 dark:to-blue-800 bg-[length:200%_200%] bg-[position:0%_0%] p-4 shadow-md transition-all duration-500 hover:-translate-y-0.5 hover:scale-[1.02] hover:bg-[position:100%_100%] hover:shadow-xl active:scale-95"
        >
          <span className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/10 blur-2xl transition-opacity duration-500 group-hover:opacity-100" />
          <div className="flex items-start justify-between">
            <div>
              <p className="text-3xl font-bold text-white">{openTasks.length + inProgressTasks.length}</p>
              <p className="text-sm font-medium mt-1 text-blue-100">Active Tasks</p>
              <p className="mt-2 text-xs text-blue-200/80">{openTasks.length} open · {inProgressTasks.length} in progress</p>
            </div>
            <span className="rounded-lg p-2 bg-white/15 text-white transition-transform duration-300 group-hover:scale-105">
              <IconList className="w-4 h-4" />
            </span>
          </div>
        </Link>
        <Link
          href="/notes"
          className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-500 via-purple-600 to-purple-700 dark:from-purple-600 dark:via-purple-700 dark:to-purple-800 bg-[length:200%_200%] bg-[position:0%_0%] p-4 shadow-md transition-all duration-500 hover:-translate-y-0.5 hover:scale-[1.02] hover:bg-[position:100%_100%] hover:shadow-xl active:scale-95"
        >
          <span className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/10 blur-2xl transition-opacity duration-500 group-hover:opacity-100" />
          <div className="flex items-start justify-between">
            <div>
              <p className="text-3xl font-bold text-white">{notes.length}</p>
              <p className="text-sm font-medium mt-1 text-purple-100">Notes</p>
              <p className="mt-2 text-xs text-purple-200/80">{notesThisWeek} updated this week</p>
            </div>
            <span className="rounded-lg p-2 bg-white/15 text-white transition-transform duration-300 group-hover:scale-105">
              <IconDocument className="w-4 h-4" />
            </span>
          </div>
        </Link>
        <Link
          href="/dispatch"
          className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-emerald-700 dark:from-emerald-600 dark:via-emerald-700 dark:to-emerald-800 bg-[length:200%_200%] bg-[position:0%_0%] p-4 shadow-md transition-all duration-500 hover:-translate-y-0.5 hover:scale-[1.02] hover:bg-[position:100%_100%] hover:shadow-xl active:scale-95"
        >
          <span className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/10 blur-2xl transition-opacity duration-500 group-hover:opacity-100" />
          <div className="flex items-start justify-between">
            <div>
              <p className="text-3xl font-bold text-white">{dispatchCount}</p>
              <p className="text-sm font-medium mt-1 text-emerald-100">Dispatches</p>
              <p className="mt-2 text-xs text-emerald-200/80">View today&apos;s dispatch</p>
            </div>
            <span className="rounded-lg p-2 bg-white/15 text-white transition-transform duration-300 group-hover:scale-105">
              <IconCalendar className="w-4 h-4" />
            </span>
          </div>
        </Link>
        <div className="group relative overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Deadline Focus
              </p>
              <p className="mt-1 text-2xl font-bold text-neutral-900 dark:text-white">
                {focusHeadline}
              </p>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                {focusSubtext}
              </p>
            </div>
            <FocusRing percent={focusPercent} toneClass={focusTone} label={focusLabel} />
          </div>
          <div className="mt-3 flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              <span className={overdue.length > 0 ? "font-semibold text-red-600 dark:text-red-400" : "text-neutral-400 dark:text-neutral-500"}>{overdue.length} overdue</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <span className={dueToday.length > 0 ? "font-semibold text-amber-600 dark:text-amber-400" : "text-neutral-400 dark:text-neutral-500"}>{dueToday.length} today</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className={dueSoon.length > 0 ? "font-semibold text-emerald-600 dark:text-emerald-400" : "text-neutral-400 dark:text-neutral-500"}>{dueSoon.length} soon</span>
            </span>
          </div>
        </div>
      </div>

      {/* Project signals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in-up" style={{ animationDelay: "130ms" }}>
        <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Active Projects</h2>
            <Link href="/projects" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
              View all
            </Link>
          </div>
          {topProjects.length === 0 ? (
            <p className="text-xs text-neutral-400 dark:text-neutral-500">No active projects yet</p>
          ) : (
            <div className="space-y-2">
              {topProjects.map((project) => {
                const color = PROJECT_COLORS[project.color]?.dot ?? "bg-blue-500";
                const barColor = PROJECT_COLORS[project.color]?.dot ?? "bg-blue-500";
                const percent = project.stats.total > 0
                  ? Math.round((project.stats.done / project.stats.total) * 100)
                  : 0;
                return (
                  <div
                    key={project.id}
                    className="space-y-1 rounded-lg p-2 -mx-2 transition-all duration-300 hover:-translate-y-px hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`h-2 w-2 rounded-full ${color}`} />
                        <span className="font-medium text-neutral-700 dark:text-neutral-300 truncate">
                          {project.name}
                        </span>
                      </div>
                      <span className="text-neutral-400 dark:text-neutral-500">
                        {project.stats.done}/{project.stats.total}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${barColor} opacity-80 transition-all duration-500`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Recent Project Activity</h2>
            <Link href="/projects" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
              Projects
            </Link>
          </div>
          {recentProjectActivity.length === 0 ? (
            <p className="text-xs text-neutral-400 dark:text-neutral-500">No project activity yet</p>
          ) : (
            <div className="space-y-1">
              {recentProjectActivity.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 text-xs rounded-lg p-2 -mx-2 transition-all duration-300 hover:-translate-y-px hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
                >
                  <div className="min-w-0">
                    <p className="text-neutral-500 dark:text-neutral-400">{item.projectName}</p>
                    <p className="font-medium text-neutral-700 dark:text-neutral-300 truncate">
                      {item.title}
                    </p>
                  </div>
                  <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_BADGES[item.status]}`}>
                    {item.status.replace("_", " ")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Due dates */}
        <section className="animate-fade-in-up" style={{ animationDelay: "150ms" }}>
          <h2 className="text-lg font-semibold mb-3 dark:text-white">Upcoming</h2>
          {overdue.length === 0 && dueToday.length === 0 && upcoming.length === 0 ? (
            <div className="rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 p-8 text-center">
              <IconCalendar className="w-8 h-8 text-neutral-300 dark:text-neutral-600 mx-auto mb-2" />
              <p className="text-sm text-neutral-400 dark:text-neutral-500">No upcoming deadlines</p>
            </div>
          ) : (
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
              {overdue.map((t, i) => (
                <DueItem key={t.id} task={t} badge="Overdue" badgeColor="red" index={i} />
              ))}
              {dueToday.map((t, i) => (
                <DueItem key={t.id} task={t} badge="Today" badgeColor="yellow" index={overdue.length + i} />
              ))}
              {upcoming.map((t, i) => (
                <DueItem key={t.id} task={t} index={overdue.length + dueToday.length + i} />
              ))}
            </div>
          )}
        </section>

        {/* Recent notes */}
        <section className="animate-fade-in-up" style={{ animationDelay: "200ms" }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold dark:text-white">Recent Notes</h2>
            <Link href="/notes" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
              View all
            </Link>
          </div>
          {recentNotes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 p-8 text-center">
              <IconDocument className="w-8 h-8 text-neutral-300 dark:text-neutral-600 mx-auto mb-2" />
              <p className="text-sm text-neutral-400 dark:text-neutral-500">No notes yet</p>
            </div>
          ) : (
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
              {recentNotes.map((n, i) => (
                <Link
                  key={n.id}
                  href={`/notes/${n.id}`}
                  className={`block p-3 transition-all duration-300 hover:-translate-y-px hover:bg-neutral-50 dark:hover:bg-neutral-800/30 ${
                    i > 0 ? "border-t border-neutral-100 dark:border-neutral-800/50" : ""
                  }`}
                >
                  <p className="font-medium text-sm truncate dark:text-white">{n.title}</p>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
                    {new Date(n.updatedAt).toLocaleDateString()}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Recent Activity */}
      <section className="animate-fade-in-up" style={{ animationDelay: "250ms" }}>
        <h2 className="text-lg font-semibold mb-3 dark:text-white">Recent Activity</h2>
        {recentActivity.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 p-8 text-center">
            <IconCalendar className="w-8 h-8 text-neutral-300 dark:text-neutral-600 mx-auto mb-2" />
            <p className="text-sm text-neutral-400 dark:text-neutral-500">No activity yet</p>
          </div>
        ) : (
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
            <ul className="border-l border-neutral-200 dark:border-neutral-800/70 pl-6 space-y-4">
              {recentActivity.map((item) => {
                const dotClass =
                  item.type === "note"
                    ? "bg-purple-500"
                    : item.status === "done"
                      ? "bg-green-500"
                      : item.status === "in_progress"
                        ? "bg-yellow-500"
                        : "bg-blue-500";

                const label =
                  item.type === "note"
                    ? "Updated note"
                    : item.status === "done"
                      ? "Completed task"
                      : "Updated task";

                return (
                  <li key={item.id} className="relative">
                    <span
                      className={`absolute -left-[12px] top-1.5 h-2.5 w-2.5 rounded-full ${dotClass}`}
                    />
                    <p className="text-sm text-neutral-700 dark:text-neutral-300">
                      <span className="font-medium">{label}:</span>{" "}
                      <span className="text-neutral-600 dark:text-neutral-300">{item.title}</span>
                    </p>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                      {new Date(item.date).toLocaleString()}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

function FocusRing({
  percent,
  toneClass,
  label,
}: {
  percent: number;
  toneClass: string;
  label: string;
}) {
  const r = 20;
  const c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;

  return (
    <svg width="56" height="56" viewBox="0 0 56 56" className="flex-shrink-0 -rotate-90">
      <circle
        cx="28"
        cy="28"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        className="text-neutral-200 dark:text-neutral-800/80"
      />
      <circle
        cx="28"
        cy="28"
        r={r}
        fill="none"
        strokeWidth="5"
        strokeLinecap="round"
        stroke="currentColor"
        className={`transition-all duration-500 ${toneClass}`}
        strokeDasharray={c}
        strokeDashoffset={offset}
      />
      <text
        x="28"
        y="28"
        textAnchor="middle"
        dominantBaseline="central"
        className="text-[10px] font-semibold fill-neutral-700 dark:fill-neutral-300 rotate-90 origin-center"
      >
        {label}
      </text>
    </svg>
  );
}

function DueItem({
  task,
  badge,
  badgeColor,
  index,
}: {
  task: Task;
  badge?: string;
  badgeColor?: "red" | "yellow";
  index: number;
}) {
  const badgeColors = {
    red: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    yellow: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  };
  return (
    <div
      className={`flex items-center gap-2 p-3 transition-all duration-300 hover:-translate-y-px hover:bg-neutral-50 dark:hover:bg-neutral-800/30 ${
        index > 0 ? "border-t border-neutral-100 dark:border-neutral-800/50" : ""
      }`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate dark:text-white">{task.title}</p>
        <p className="text-xs text-neutral-400 dark:text-neutral-500">
          Due {task.dueDate}
        </p>
      </div>
      {badge && badgeColor && (
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badgeColors[badgeColor]}`}>
          {badge}
        </span>
      )}
    </div>
  );
}
