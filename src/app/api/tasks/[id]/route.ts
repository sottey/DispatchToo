import { withAuth, jsonResponse, errorResponse } from "@/lib/api";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { eq, and } from "drizzle-orm";

const VALID_STATUSES = ["open", "in_progress", "done"] as const;
const VALID_PRIORITIES = ["low", "medium", "high"] as const;

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/tasks/[id] — get a single task */
export const GET = withAuth(async (req, session, ctx) => {
  const { id } = await (ctx as RouteContext).params;

  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.userId, session.user!.id!)));

  if (!task) {
    return errorResponse("Task not found", 404);
  }

  return jsonResponse(task);
});

/** PUT /api/tasks/[id] — update a task */
export const PUT = withAuth(async (req, session, ctx) => {
  const { id } = await (ctx as RouteContext).params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const { title, description, status, priority, dueDate } = body as Record<string, unknown>;

  if (title !== undefined && (typeof title !== "string" || title.trim().length === 0)) {
    return errorResponse("title must be a non-empty string", 400);
  }

  if (title && (title as string).length > 500) {
    return errorResponse("title must be at most 500 characters", 400);
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

  if (priority !== undefined) {
    if (!VALID_PRIORITIES.includes(priority as typeof VALID_PRIORITIES[number])) {
      return errorResponse(`Invalid priority. Must be one of: ${VALID_PRIORITIES.join(", ")}`, 400);
    }
  }

  if (dueDate !== undefined && dueDate !== null && typeof dueDate !== "string") {
    return errorResponse("dueDate must be a string (ISO date) or null", 400);
  }

  // Check task exists and belongs to user
  const [existing] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.userId, session.user!.id!)));

  if (!existing) {
    return errorResponse("Task not found", 404);
  }

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (title !== undefined) updates.title = (title as string).trim();
  if (description !== undefined) updates.description = description;
  if (status !== undefined) updates.status = status;
  if (priority !== undefined) updates.priority = priority;
  if (dueDate !== undefined) updates.dueDate = dueDate;

  const [updated] = await db
    .update(tasks)
    .set(updates)
    .where(eq(tasks.id, id))
    .returning();

  return jsonResponse(updated);
});

/** DELETE /api/tasks/[id] — delete a task */
export const DELETE = withAuth(async (req, session, ctx) => {
  const { id } = await (ctx as RouteContext).params;

  const [existing] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.userId, session.user!.id!)));

  if (!existing) {
    return errorResponse("Task not found", 404);
  }

  await db.delete(tasks).where(eq(tasks.id, id));

  return jsonResponse({ deleted: true });
});
