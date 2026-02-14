import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { dispatchTasks, dispatches, notes, tasks } from "@/db/schema";

const TEMPLATE_NOTE_TITLE = "TasklistTemplate";
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const MONTH_KEYS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
] as const;

export type DispatchTemplateTask = {
  title: string;
  dueDate: string | null;
};

export async function getOrCreateDispatchForDate(userId: string, date: string) {
  const [existing] = await db
    .select()
    .from(dispatches)
    .where(and(eq(dispatches.userId, userId), eq(dispatches.date, date)))
    .limit(1);

  if (existing) {
    return { dispatch: existing, created: false, templateTaskCount: 0 };
  }

  const now = new Date().toISOString();
  const [created] = await db
    .insert(dispatches)
    .values({
      userId,
      date,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  const templateTaskCount = await applyTemplateTasksToDispatch(userId, created.id, date, now);
  return { dispatch: created, created: true, templateTaskCount };
}

export async function applyTemplateTasksToDispatch(
  userId: string,
  dispatchId: string,
  date: string,
  now = new Date().toISOString(),
): Promise<number> {
  const [templateNote] = await db
    .select({ content: notes.content })
    .from(notes)
    .where(
      and(
        eq(notes.userId, userId),
        eq(notes.title, TEMPLATE_NOTE_TITLE),
        isNull(notes.deletedAt),
      ),
    )
    .limit(1);

  if (!templateNote?.content) return 0;

  const templateTasks = parseDispatchTemplate(templateNote.content, date);
  if (templateTasks.length === 0) return 0;

  for (const templateTask of templateTasks) {
    const [createdTask] = await db
      .insert(tasks)
      .values({
        userId,
        title: templateTask.title,
        dueDate: templateTask.dueDate,
        status: "open",
        priority: "medium",
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: tasks.id });

    await db.insert(dispatchTasks).values({
      dispatchId,
      taskId: createdTask.id,
    });
  }

  return templateTasks.length;
}

export function parseDispatchTemplate(content: string, targetDate: string): DispatchTemplateTask[] {
  const date = parseIsoDate(targetDate);
  if (!date) return [];

  const lines = content.split(/\r?\n/);
  const conditionStack: boolean[] = [];
  const tasksOut: DispatchTemplateTask[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const inlineIfMatch = line.match(/^\{\{if:([^}]+)\}\}(.*)$/i);
    if (inlineIfMatch) {
      const conditionMet = matchesCondition(inlineIfMatch[1], date);
      const inlineRemainder = inlineIfMatch[2]?.trim() ?? "";

      if (inlineRemainder.length > 0) {
        if (!conditionMet) continue;
        const inlineTask = parseTaskLine(inlineRemainder, date);
        if (inlineTask) tasksOut.push(inlineTask);
        continue;
      }
    }

    const ifMatch = line.match(/^\{\{if:(.+)\}\}$/i);
    if (ifMatch) {
      conditionStack.push(matchesCondition(ifMatch[1], date));
      continue;
    }

    if (/^\{\{endif\}\}$/i.test(line)) {
      if (conditionStack.length > 0) {
        conditionStack.pop();
      }
      continue;
    }

    const isEnabled = conditionStack.every(Boolean);
    if (!isEnabled) continue;

    const task = parseTaskLine(rawLine, date);
    if (!task) continue;
    tasksOut.push(task);
  }

  return tasksOut;
}

function parseTaskLine(line: string, date: Date): DispatchTemplateTask | null {
  const taskMatch = line.match(/^\s*[-*]\s+\[\s\]\s+(.+?)\s*$/);
  if (!taskMatch) return null;

  const renderedText = renderDatePlaceholders(taskMatch[1], date).trim();
  if (!renderedText) return null;

  const dueMatch = renderedText.match(/\s>(\d{4}-\d{2}-\d{2})\s*$/);
  const dueDate = dueMatch?.[1] ?? null;
  const title = (dueMatch ? renderedText.slice(0, dueMatch.index) : renderedText).trim();
  if (!title) return null;

  return { title, dueDate };
}

function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map((part) => Number.parseInt(part, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date;
}

function matchesCondition(expr: string, date: Date): boolean {
  const clauses = expr
    .split("&")
    .map((part) => part.trim())
    .filter(Boolean);

  if (clauses.length === 0) return false;

  for (const clause of clauses) {
    const [rawKey, rawValue] = clause.split("=", 2).map((part) => part?.trim() ?? "");
    if (!rawKey || !rawValue) return false;

    const key = rawKey.toLowerCase();
    if (key === "day") {
      if (!matchesDayCondition(rawValue, date)) return false;
      continue;
    }
    if (key === "dom") {
      if (!matchesDomCondition(rawValue, date)) return false;
      continue;
    }
    if (key === "month") {
      if (!matchesMonthCondition(rawValue, date)) return false;
      continue;
    }
    return false;
  }

  return true;
}

function matchesDayCondition(value: string, date: Date): boolean {
  const tokens = value
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);

  if (tokens.length === 0) return false;

  const day = DAY_KEYS[date.getUTCDay()];
  const isWeekday = day !== "sat" && day !== "sun";

  return tokens.some((token) => {
    if (token === "weekday") return isWeekday;
    if (token === "weekend") return !isWeekday;
    const normalized = normalizeDayToken(token);
    return normalized === day;
  });
}

function matchesDomCondition(value: string, date: Date): boolean {
  const dayOfMonth = date.getUTCDate();
  const values = value
    .split(",")
    .map((token) => Number.parseInt(token.trim(), 10))
    .filter((n) => Number.isFinite(n));

  return values.includes(dayOfMonth);
}

function matchesMonthCondition(value: string, date: Date): boolean {
  const month = MONTH_KEYS[date.getUTCMonth()];
  const values = value
    .split(",")
    .map((token) => normalizeMonthToken(token.trim().toLowerCase()))
    .filter((token): token is (typeof MONTH_KEYS)[number] => token !== null);

  return values.includes(month);
}

function normalizeDayToken(token: string): (typeof DAY_KEYS)[number] | null {
  const normalized = token.slice(0, 3) as (typeof DAY_KEYS)[number];
  return DAY_KEYS.includes(normalized) ? normalized : null;
}

function normalizeMonthToken(token: string): (typeof MONTH_KEYS)[number] | null {
  const normalized = token.slice(0, 3) as (typeof MONTH_KEYS)[number];
  return MONTH_KEYS.includes(normalized) ? normalized : null;
}

function renderDatePlaceholders(input: string, date: Date): string {
  return input.replace(/\{\{date:([^}]+)\}\}/g, (_match, pattern) => formatDate(date, pattern));
}

function formatDate(date: Date, pattern: string): string {
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return pattern
    .replace(/YYYY/g, year)
    .replace(/MM/g, month)
    .replace(/DD/g, day);
}
