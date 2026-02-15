export const PROJECT_COLORS: Record<
  string,
  { label: string; dot: string; badge: string; soft: string }
> = {
  blue: {
    label: "Blue",
    dot: "bg-blue-500",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    soft: "bg-blue-50/80 text-blue-700 border-blue-200/70 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800/60",
  },
  emerald: {
    label: "Emerald",
    dot: "bg-emerald-500",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    soft: "bg-emerald-50/80 text-emerald-700 border-emerald-200/70 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800/60",
  },
  amber: {
    label: "Amber",
    dot: "bg-amber-500",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    soft: "bg-amber-50/80 text-amber-700 border-amber-200/70 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800/60",
  },
  rose: {
    label: "Rose",
    dot: "bg-rose-500",
    badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
    soft: "bg-rose-50/80 text-rose-700 border-rose-200/70 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800/60",
  },
  violet: {
    label: "Violet",
    dot: "bg-violet-500",
    badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    soft: "bg-violet-50/80 text-violet-700 border-violet-200/70 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-800/60",
  },
  slate: {
    label: "Slate",
    dot: "bg-slate-500",
    badge: "bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300",
    soft: "bg-slate-50/80 text-slate-700 border-slate-200/70 dark:bg-slate-900/20 dark:text-slate-300 dark:border-slate-800/60",
  },
};

export const PROJECT_COLOR_OPTIONS = Object.entries(PROJECT_COLORS).map(
  ([value, config]) => ({
    value,
    label: config.label,
    dot: config.dot,
  }),
);

export const PROJECT_STATUS_OPTIONS = [
  { value: "active", label: "Active", dot: "bg-emerald-500" },
  { value: "paused", label: "Paused", dot: "bg-yellow-500" },
  { value: "completed", label: "Completed", dot: "bg-neutral-400" },
];
