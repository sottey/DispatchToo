import { IconBolt } from "@/components/icons";

export function BrandMark({
  className = "",
  iconClassName = "",
  compact = false,
}: {
  className?: string;
  iconClassName?: string;
  compact?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 via-cyan-500 to-emerald-500 shadow-[0_10px_24px_-14px_rgba(56,189,248,0.9)] ${
        compact ? "h-10 w-10" : "h-12 w-12"
      } ${className}`}
      aria-hidden="true"
    >
      <span className="inline-flex h-full w-full items-center justify-center rounded-[inherit] bg-white/10">
        <IconBolt className={`${compact ? "h-5 w-5" : "h-6 w-6"} text-white ${iconClassName}`} />
      </span>
    </span>
  );
}
