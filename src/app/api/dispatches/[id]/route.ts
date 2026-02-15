import { withAuth, jsonResponse, errorResponse } from "@/lib/api";
import { db } from "@/db";
import { dispatches, notes } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";

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

  if (summary !== undefined) {
    const now = new Date().toISOString();
    const noteTitle = `Daily Dispatch - ${updated.date}`;
    const summaryContent = (summary as string).trim();

    const [existingNote] = await db
      .select({ id: notes.id })
      .from(notes)
      .where(
        and(
          eq(notes.userId, session.user!.id!),
          eq(notes.title, noteTitle),
          isNull(notes.deletedAt),
        ),
      );

    if (existingNote) {
      await db
        .update(notes)
        .set({
          content: summaryContent,
          updatedAt: now,
        })
        .where(eq(notes.id, existingNote.id));
    } else {
      await db.insert(notes).values({
        userId: session.user!.id!,
        title: noteTitle,
        content: summaryContent,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

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
