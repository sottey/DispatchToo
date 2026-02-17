import { withAuth, jsonResponse, errorResponse } from "@/lib/api";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { db } from "@/db";
import { notes } from "@/db/schema";
import { eq, and, like, sql, isNull } from "drizzle-orm";
import {
  FrontmatterValidationError,
  parseAndNormalizeNoteFrontmatter,
  parseStoredNoteMetadata,
} from "@/lib/note-frontmatter";

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

function noteHasTag(note: NoteResponse, tag: string): boolean {
  if (!note.metadata) return false;

  const entries = Object.entries(note.metadata);
  const tagsKey = entries.find(([key]) => {
    const normalized = key.trim().toLowerCase();
    return normalized === "tags" || normalized === "tag" || normalized === "keywords";
  })?.[0];
  if (!tagsKey) return false;

  const value = note.metadata[tagsKey];
  if (Array.isArray(value)) {
    return value.some(
      (entry) => typeof entry === "string" && entry.trim().toLowerCase() === tag,
    );
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean)
      .includes(tag);
  }
  return false;
}

/** GET /api/notes — list notes for the current user */
export const GET = withAuth(async (req, session) => {
  const url = new URL(req.url);
  const search = url.searchParams.get("search");
  const type = url.searchParams.get("type");
  const folderId = url.searchParams.get("folderId");
  const projectId = url.searchParams.get("projectId");
  const dispatchDate = url.searchParams.get("dispatchDate");
  const tag = url.searchParams.get("tag")?.trim().toLowerCase();

  const conditions = [eq(notes.userId, session.user!.id!), isNull(notes.deletedAt)];

  if (search) {
    const escaped = search.replace(/%/g, "\\%").replace(/_/g, "\\_");
    conditions.push(like(sql`LOWER(${notes.title})`, `%${escaped.toLowerCase()}%`));
  }
  if (type) conditions.push(eq(notes.type, type));
  if (folderId) conditions.push(eq(notes.folderId, folderId));
  if (projectId) conditions.push(eq(notes.projectId, projectId));
  if (dispatchDate) conditions.push(eq(notes.dispatchDate, dispatchDate));

  const where = and(...conditions);
  const allResults = await db
    .select()
    .from(notes)
    .where(where);

  const withMetadata = allResults.map(toNoteResponse);
  const filteredByTag = tag
    ? withMetadata.filter((note) => noteHasTag(note, tag))
    : withMetadata;

  const sorted = filteredByTag.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const pagination = parsePagination(url);
  if (!pagination) {
    return jsonResponse(sorted);
  }

  const start = (pagination.page - 1) * pagination.limit;
  const paged = sorted.slice(start, start + pagination.limit);
  return jsonResponse(paginatedResponse(paged, sorted.length, pagination));
});

/** POST /api/notes — create a new note */
export const POST = withAuth(async (req, session) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const { title, content } = body as Record<string, unknown>;

  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return errorResponse("title is required and must be a non-empty string", 400);
  }

  if ((title as string).length > 500) {
    return errorResponse("title must be at most 500 characters", 400);
  }

  if (content !== undefined && typeof content !== "string") {
    return errorResponse("content must be a string", 400);
  }

  if (content && (content as string).length > 100000) {
    return errorResponse("content must be at most 100000 characters", 400);
  }

  let frontmatter;
  try {
    frontmatter = parseAndNormalizeNoteFrontmatter((content as string | undefined) ?? null);
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

  const now = new Date().toISOString();

  const [note] = await db
    .insert(notes)
    .values({
      userId: session.user!.id!,
      title: (title as string).trim(),
      content: content as string | undefined,
      metadata: frontmatter.metadata ? JSON.stringify(frontmatter.metadata) : null,
      type: frontmatter.type,
      folderId: frontmatter.folderId,
      projectId: frontmatter.projectId,
      dispatchDate: frontmatter.dispatchDate,
      hasRecurrence: frontmatter.hasRecurrence,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return jsonResponse(toNoteResponse(note), 201);
});
