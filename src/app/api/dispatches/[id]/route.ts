import { withAuth, jsonResponse, errorResponse } from "@/lib/api";
import { db } from "@/db";
import { dispatches } from "@/db/schema";
import { eq, and } from "drizzle-orm";

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/dispatches/[id] — get a single dispatch */
export const GET = withAuth(async (req, session, ctx) => {
  const { id } = await (ctx as RouteContext).params;

  const [dispatch] = await db
    .select()
    .from(dispatches)
    .where(and(eq(dispatches.id, id), eq(dispatches.userId, session.user!.id!)));

  if (!dispatch) {
    return errorResponse("Dispatch not found", 404);
  }

  return jsonResponse(dispatch);
});

/** PUT /api/dispatches/[id] — update a dispatch */
export const PUT = withAuth(async (req, session, ctx) => {
  const { id } = await (ctx as RouteContext).params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const { summary } = body as Record<string, unknown>;

  if (summary !== undefined && typeof summary !== "string") {
    return errorResponse("summary must be a string", 400);
  }

  if (summary && (summary as string).length > 10000) {
    return errorResponse("summary must be at most 10000 characters", 400);
  }

  // Check dispatch exists and belongs to user
  const [existing] = await db
    .select({ id: dispatches.id, finalized: dispatches.finalized })
    .from(dispatches)
    .where(and(eq(dispatches.id, id), eq(dispatches.userId, session.user!.id!)));

  if (!existing) {
    return errorResponse("Dispatch not found", 404);
  }

  if (existing.finalized) {
    return errorResponse("Cannot edit a finalized dispatch", 400);
  }

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (summary !== undefined) updates.summary = summary;

  const [updated] = await db
    .update(dispatches)
    .set(updates)
    .where(eq(dispatches.id, id))
    .returning();

  return jsonResponse(updated);
});

/** DELETE /api/dispatches/[id] — delete a dispatch */
export const DELETE = withAuth(async (req, session, ctx) => {
  const { id } = await (ctx as RouteContext).params;

  const [existing] = await db
    .select({ id: dispatches.id })
    .from(dispatches)
    .where(and(eq(dispatches.id, id), eq(dispatches.userId, session.user!.id!)));

  if (!existing) {
    return errorResponse("Dispatch not found", 404);
  }

  await db.delete(dispatches).where(eq(dispatches.id, id));

  return jsonResponse({ deleted: true });
});
