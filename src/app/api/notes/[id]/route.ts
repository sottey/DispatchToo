import { withAuth, jsonResponse, errorResponse } from "@/lib/api";
import { db } from "@/db";
import { notes } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/notes/[id] — get a single note */
export const GET = withAuth(async (req, session, ctx) => {
  const { id } = await (ctx as RouteContext).params;

  const [note] = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, id), eq(notes.userId, session.user!.id!), isNull(notes.deletedAt)));

  if (!note) {
    return errorResponse("Note not found", 404);
  }

  return jsonResponse(note);
});

/** PUT /api/notes/[id] — update a note */
export const PUT = withAuth(async (req, session, ctx) => {
  const { id } = await (ctx as RouteContext).params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const { title, content } = body as Record<string, unknown>;

  if (title !== undefined && (typeof title !== "string" || title.trim().length === 0)) {
    return errorResponse("title must be a non-empty string", 400);
  }

  if (title && (title as string).length > 500) {
    return errorResponse("title must be at most 500 characters", 400);
  }

  if (content !== undefined && typeof content !== "string") {
    return errorResponse("content must be a string", 400);
  }

  if (content && (content as string).length > 100000) {
    return errorResponse("content must be at most 100000 characters", 400);
  }

  // Check note exists, belongs to user, and is not soft-deleted
  const [existing] = await db
    .select({ id: notes.id })
    .from(notes)
    .where(and(eq(notes.id, id), eq(notes.userId, session.user!.id!), isNull(notes.deletedAt)));

  if (!existing) {
    return errorResponse("Note not found", 404);
  }

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (title !== undefined) updates.title = (title as string).trim();
  if (content !== undefined) updates.content = content;

  const [updated] = await db
    .update(notes)
    .set(updates)
    .where(eq(notes.id, id))
    .returning();

  return jsonResponse(updated);
});

/** DELETE /api/notes/[id] — soft-delete a note (moves to recycle bin) */
export const DELETE = withAuth(async (req, session, ctx) => {
  const { id } = await (ctx as RouteContext).params;

  const [existing] = await db
    .select({ id: notes.id, deletedAt: notes.deletedAt })
    .from(notes)
    .where(and(eq(notes.id, id), eq(notes.userId, session.user!.id!)));

  if (!existing || existing.deletedAt) {
    return errorResponse("Note not found", 404);
  }

  await db
    .update(notes)
    .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    .where(eq(notes.id, id));

  return jsonResponse({ deleted: true });
});
