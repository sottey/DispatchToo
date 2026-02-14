const DATE_PART_FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();
const DISPLAY_FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();

function getDatePartFormatter(timeZone: string | null): Intl.DateTimeFormat {
  const key = timeZone ?? "__local__";
  const existing = DATE_PART_FORMATTER_CACHE.get(key);
  if (existing) return existing;

  const formatter = new Intl.DateTimeFormat("en-US", {
    ...(timeZone ? { timeZone } : {}),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  DATE_PART_FORMATTER_CACHE.set(key, formatter);
  return formatter;
}

export function getConfiguredTimeZone(): string | null {
  if (typeof window !== "undefined") {
    const tz = (window as Window & { __DISPATCH_TZ?: unknown }).__DISPATCH_TZ;
    if (typeof tz === "string" && tz.trim().length > 0) {
      return tz.trim();
    }
    return null;
  }

  const tz = process.env.TZ?.trim();
  return tz && tz.length > 0 ? tz : null;
}

export function formatDateKey(date: Date, timeZone: string | null = getConfiguredTimeZone()): string {
  const formatter = getDatePartFormatter(timeZone);
  const parts = formatter.formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
}

export function todayDateKey(timeZone: string | null = getConfiguredTimeZone()): string {
  return formatDateKey(new Date(), timeZone);
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid date key "${dateKey}". Expected YYYY-MM-DD.`);
  }

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  const next = new Date(Date.UTC(year, month - 1, day + days));

  const y = String(next.getUTCFullYear());
  const m = String(next.getUTCMonth() + 1).padStart(2, "0");
  const d = String(next.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function endOfMonthDateKey(year: number, month: number): string {
  const date = new Date(Date.UTC(year, month, 0));
  const y = String(date.getUTCFullYear());
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

type DateStyleOptions = Pick<
  Intl.DateTimeFormatOptions,
  "year" | "month" | "day" | "weekday" | "hour" | "minute" | "second"
>;

function formatterCacheKey(
  locale: string | undefined,
  timeZone: string | null,
  options: DateStyleOptions,
): string {
  return JSON.stringify({
    locale: locale ?? "__default__",
    timeZone: timeZone ?? "__local__",
    options,
  });
}

function getDisplayFormatter(
  options: DateStyleOptions,
  params?: { locale?: string; timeZone?: string | null },
): Intl.DateTimeFormat {
  const locale = params?.locale;
  const timeZone = params?.timeZone ?? getConfiguredTimeZone();
  const key = formatterCacheKey(locale, timeZone, options);
  const existing = DISPLAY_FORMATTER_CACHE.get(key);
  if (existing) return existing;

  const formatter = new Intl.DateTimeFormat(locale, {
    ...options,
    ...(timeZone ? { timeZone } : {}),
  });
  DISPLAY_FORMATTER_CACHE.set(key, formatter);
  return formatter;
}

export function formatTimestamp(
  value: string | Date,
  options: DateStyleOptions,
  params?: { locale?: string; timeZone?: string | null },
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return getDisplayFormatter(options, params).format(date);
}

function parseDateKey(dateKey: string): Date | null {
  const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  return new Date(Date.UTC(year, month - 1, day));
}

export function formatDateKeyForDisplay(
  dateKey: string,
  options: DateStyleOptions,
  params?: { locale?: string },
): string {
  const date = parseDateKey(dateKey);
  if (!date) return dateKey;
  return formatTimestamp(date, options, { ...params, timeZone: "UTC" });
}
