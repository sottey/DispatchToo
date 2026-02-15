"use client";

type PriorityDistributionProps = {
  highCount: number;
  mediumCount: number;
  lowCount: number;
};

type PrioritySegment = {
  key: "high" | "medium" | "low";
  label: string;
  value: number;
  barClass: string;
  textClass: string;
};

export function PriorityDistribution({
  highCount,
  mediumCount,
  lowCount,
}: PriorityDistributionProps) {
  const segments: PrioritySegment[] = [
    {
      key: "high",
      label: "High",
      value: highCount,
      barClass: "bg-rose-500 dark:bg-rose-400",
      textClass: "text-rose-700 dark:text-rose-300",
    },
    {
      key: "medium",
      label: "Medium",
      value: mediumCount,
      barClass: "bg-amber-500 dark:bg-amber-400",
      textClass: "text-amber-700 dark:text-amber-300",
    },
    {
      key: "low",
      label: "Low",
      value: lowCount,
      barClass: "bg-emerald-500 dark:bg-emerald-400",
      textClass: "text-emerald-700 dark:text-emerald-300",
    },
  ];

  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  return (
    <div className="space-y-4">
      <div className="relative flex h-10 overflow-hidden rounded-full border border-neutral-200/85 bg-neutral-100/70 dark:border-neutral-700/80 dark:bg-neutral-900/60">
        {segments.map((segment, index) => {
          const widthPercent = total > 0 ? (segment.value / total) * 100 : 0;
          const showInlineLabel = widthPercent >= 18;
          return (
            <div
              key={segment.key}
              className={`relative flex items-center justify-center ${segment.barClass}`}
              style={{
                width: `${widthPercent}%`,
                minWidth: segment.value > 0 ? "10%" : "0%",
              }}
            >
              {showInlineLabel && (
                <span className="text-[11px] font-semibold text-white/95">
                  {segment.value}
                </span>
              )}
              {index < segments.length - 1 && (
                <span className="absolute right-0 top-1/2 h-6 w-px -translate-y-1/2 bg-white/35" />
              )}
            </div>
          );
        })}
      </div>

      <div className="space-y-2.5">
        {segments.map((segment) => {
          const percent = total > 0 ? Math.round((segment.value / total) * 100) : 0;
          return (
            <div key={segment.key} className="flex items-center justify-between gap-2 text-xs">
              <div className="inline-flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${segment.barClass}`} />
                <span className={`font-medium ${segment.textClass}`}>{segment.label}</span>
              </div>
              <span className="text-neutral-600 dark:text-neutral-300">
                {segment.value} tasks ({percent}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
