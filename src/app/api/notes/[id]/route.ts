import { withAuth, jsonResponse, errorResponse } from "@/lib/api";
import { db } from "@/db";
import { notes } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import {
  FrontmatterValidationError,
  parseAndNormalizeNoteFrontmatter,
  parseStoredNoteMetadata,
} from "@/lib/note-frontmatter";

type RouteContext = { params: Promise<{ id: string }> };
type NoteResponse = Omit<typeof notes.$inferSelect, "metadata"> & {
  metadata: Record<string, unknown> | null;
};

function toNoteResponse(note: typeof notes.$inferSelect): NoteResponse {
  const storedMetadata = parseStoredNoteMetadata(note.metadata);
  if (storedMetadata) {
    return {
      ...note,
      metadata: storedMetadata,
    };
  }

  if (typeof note.content === "string" && note.content.length > 0) {
    try {
      const parsed = parseAndNormalizeNoteFrontmatter(note.content);
      return {
        ...note,
        metadata: parsed.metadata,
      };
    } catch {
      // Fall back to null metadata for malformed content.
    }
  }

  return {
    ...note,
    metadata: null,
  };
}

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

  return jsonResponse(toNoteResponse(note));
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
    .select({
      id: notes.id,
      content: notes.content,
      metadata: notes.metadata,
      type: notes.type,
      folderId: notes.folderId,
      projectId: notes.projectId,
      dispatchDate: notes.dispatchDate,
      hasRecurrence: notes.hasRecurrence,
    })
    .from(notes)
    .where(and(eq(notes.id, id), eq(notes.userId, session.user!.id!), isNull(notes.deletedAt)));

  if (!existing) {
    return errorResponse("Note not found", 404);
  }

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (title !== undefined) updates.title = (title as string).trim();
  if (content !== undefined) updates.content = content;

  if (content !== undefined) {
    try {
      const frontmatter = parseAndNormalizeNoteFrontmatter(content as string);
      updates.metadata = frontmatter.metadata ? JSON.stringify(frontmatter.metadata) : null;
      updates.type = frontmatter.type;
      updates.folderId = frontmatter.folderId;
      updates.projectId = frontmatter.projectId;
      updates.dispatchDate = frontmatter.dispatchDate;
      updates.hasRecurrence = frontmatter.hasRecurrence;
    } catch (error) {
      if (error instanceof FrontmatterValidationError) {
        return jsonResponse(
          {
            error: "Invalid frontmatter",
            details: error.details,
          },
          400,
        );
      }
      throw error;
    }
  }

  const [updated] = await db
    .update(notes)
    .set(updates)
    .where(eq(notes.id, id))
    .returning();

  return jsonResponse(toNoteResponse(updated));
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
