"use client";

export function ProjectsPage() {
  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-bold dark:text-white">Projects</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          Group related tasks into focused projects.
        </p>
      </div>

      <div className="rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 p-16 text-center">
        <svg className="w-12 h-12 text-neutral-300 dark:text-neutral-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h12A2.25 2.25 0 0 1 20.25 6v12A2.25 2.25 0 0 1 18 20.25H6A2.25 2.25 0 0 1 3.75 18V6Zm4.5 3.75h7.5m-7.5 4.5h7.5" />
        </svg>
        <p className="text-neutral-500 dark:text-neutral-400 font-medium">No projects yet</p>
        <p className="text-sm text-neutral-400 dark:text-neutral-500 mt-1">
          Create your first project to start grouping tasks.
        </p>
      </div>
    </div>
  );
}
