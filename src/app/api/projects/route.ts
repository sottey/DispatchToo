import { withAuth, jsonResponse, errorResponse } from "@/lib/api";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { db } from "@/db";
import { projects, tasks } from "@/db/schema";
import { eq, and, sql, inArray, isNotNull, isNull } from "drizzle-orm";

const VALID_STATUSES = ["active", "paused", "completed"] as const;
const VALID_COLORS = ["blue", "emerald", "amber", "rose", "violet", "slate"] as const;

type ProjectRow = typeof projects.$inferSelect;

type ProjectStats = {
  total: number;
  open: number;
  inProgress: number;
  done: number;
};

async function attachStats(userId: string, rows: ProjectRow[]) {
  if (rows.length === 0) return rows.map((project) => ({ ...project, stats: { total: 0, open: 0, inProgress: 0, done: 0 } }));

  const ids = rows.map((project) => project.id);
  const counts = await db
    .select({
      projectId: tasks.projectId,
      total: sql<number>`count(*)`,
      open: sql<number>`sum(case when ${tasks.status} = 'open' then 1 else 0 end)`,
      inProgress: sql<number>`sum(case when ${tasks.status} = 'in_progress' then 1 else 0 end)`,
      done: sql<number>`sum(case when ${tasks.status} = 'done' then 1 else 0 end)`,
    })
    .from(tasks)
    .where(and(eq(tasks.userId, userId), isNotNull(tasks.projectId), inArray(tasks.projectId, ids), isNull(tasks.deletedAt)))
    .groupBy(tasks.projectId);

  const statsById = new Map<string, ProjectStats>();
  for (const row of counts) {
    if (!row.projectId) continue;
    statsById.set(row.projectId, {
      total: row.total ?? 0,
      open: row.open ?? 0,
      inProgress: row.inProgress ?? 0,
      done: row.done ?? 0,
    });
  }

  return rows.map((project) => ({
    ...project,
    stats: statsById.get(project.id) ?? { total: 0, open: 0, inProgress: 0, done: 0 },
  }));
}

/** GET /api/projects — list projects for the current user */
export const GET = withAuth(async (req, session) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const include = url.searchParams.get("include");

  const conditions = [eq(projects.userId, session.user!.id!), isNull(projects.deletedAt)];

  if (status) {
    if (!VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
      return errorResponse(`Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`, 400);
    }
    conditions.push(eq(projects.status, status as typeof VALID_STATUSES[number]));
  }

  const where = and(...conditions);
  const pagination = parsePagination(url);

  if (pagination) {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(projects)
      .where(where);

    const results = await db
      .select()
      .from(projects)
      .where(where)
      .orderBy(projects.createdAt)
      .limit(pagination.limit)
      .offset((pagination.page - 1) * pagination.limit);

    if (include === "stats") {
      const withStats = await attachStats(session.user!.id!, results);
      return jsonResponse(paginatedResponse(withStats, count, pagination));
    }

    return jsonResponse(paginatedResponse(results, count, pagination));
  }

  const results = await db
    .select()
    .from(projects)
    .where(where)
    .orderBy(projects.createdAt);

  if (include === "stats") {
    const withStats = await attachStats(session.user!.id!, results);
    return jsonResponse(withStats);
  }

  return jsonResponse(results);
});

/** POST /api/projects — create a new project */
export const POST = withAuth(async (req, session) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const { name, description, status, color } = body as Record<string, unknown>;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return errorResponse("name is required and must be a non-empty string", 400);
  }

  if ((name as string).length > 200) {
    return errorResponse("name must be at most 200 characters", 400);
  }

  if (description !== undefined && typeof description !== "string") {
    return errorResponse("description must be a string", 400);
  }

  if (description && (description as string).length > 5000) {
    return errorResponse("description must be at most 5000 characters", 400);
  }

  if (status !== undefined) {
    if (!VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
      return errorResponse(`Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`, 400);
    }
  }

  if (color !== undefined) {
    if (!VALID_COLORS.includes(color as typeof VALID_COLORS[number])) {
      return errorResponse(`Invalid color. Must be one of: ${VALID_COLORS.join(", ")}`, 400);
    }
  }

  const now = new Date().toISOString();

  const [project] = await db
    .insert(projects)
    .values({
      userId: session.user!.id!,
      name: (name as string).trim(),
      description: description as string | undefined,
      status: (status as typeof VALID_STATUSES[number]) ?? "active",
      color: (color as typeof VALID_COLORS[number]) ?? "blue",
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return jsonResponse(project, 201);
});
