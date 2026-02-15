import { withAuth, jsonResponse, errorResponse } from "@/lib/api";
import { db } from "@/db";
import { projects, tasks } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";

const VALID_STATUSES = ["active", "paused", "completed"] as const;
const VALID_COLORS = ["blue", "emerald", "amber", "rose", "violet", "slate"] as const;

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/projects/[id] — get a single project */
export const GET = withAuth(async (req, session, ctx) => {
  const { id } = await (ctx as RouteContext).params;

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, session.user!.id!), isNull(projects.deletedAt)));

  if (!project) {
    return errorResponse("Project not found", 404);
  }

  return jsonResponse(project);
});

/** PUT /api/projects/[id] — update a project */
export const PUT = withAuth(async (req, session, ctx) => {
  const { id } = await (ctx as RouteContext).params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const { name, description, status, color } = body as Record<string, unknown>;

  if (name !== undefined && (typeof name !== "string" || name.trim().length === 0)) {
    return errorResponse("name must be a non-empty string", 400);
  }

  if (name && (name as string).length > 200) {
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

  const [existing] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, session.user!.id!), isNull(projects.deletedAt)));

  if (!existing) {
    return errorResponse("Project not found", 404);
  }

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (name !== undefined) updates.name = (name as string).trim();
  if (description !== undefined) updates.description = description;
  if (status !== undefined) updates.status = status;
  if (color !== undefined) updates.color = color;

  const [updated] = await db
    .update(projects)
    .set(updates)
    .where(eq(projects.id, id))
    .returning();

  return jsonResponse(updated);
});

/** DELETE /api/projects/[id] — soft-delete a project (moves to recycle bin) */
export const DELETE = withAuth(async (req, session, ctx) => {
  const { id } = await (ctx as RouteContext).params;

  const [existing] = await db
    .select({ id: projects.id, deletedAt: projects.deletedAt })
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, session.user!.id!)));

  if (!existing || existing.deletedAt) {
    return errorResponse("Project not found", 404);
  }

  const now = new Date().toISOString();

  // Detach tasks from this project (only non-deleted tasks)
  await db
    .update(tasks)
    .set({ projectId: null, updatedAt: now })
    .where(and(eq(tasks.userId, session.user!.id!), eq(tasks.projectId, id), isNull(tasks.deletedAt)));

  await db
    .update(projects)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(projects.id, id));

  return jsonResponse({ deleted: true });
});
