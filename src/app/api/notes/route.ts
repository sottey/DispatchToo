import { withAuth, jsonResponse, errorResponse } from "@/lib/api";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { db } from "@/db";
import { notes } from "@/db/schema";
import { eq, and, like, sql } from "drizzle-orm";

/** GET /api/notes — list notes for the current user */
export const GET = withAuth(async (req, session) => {
  const url = new URL(req.url);
  const search = url.searchParams.get("search");

  const conditions = [eq(notes.userId, session.user!.id!)];

  if (search) {
    const escaped = search.replace(/%/g, "\\%").replace(/_/g, "\\_");
    conditions.push(like(sql`LOWER(${notes.title})`, `%${escaped.toLowerCase()}%`));
  }

  const where = and(...conditions);
  const pagination = parsePagination(url);

  if (pagination) {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(notes)
      .where(where);

    const results = await db
      .select()
      .from(notes)
      .where(where)
      .orderBy(notes.createdAt)
      .limit(pagination.limit)
      .offset((pagination.page - 1) * pagination.limit);

    return jsonResponse(paginatedResponse(results, count, pagination));
  }

  const results = await db
    .select()
    .from(notes)
    .where(where)
    .orderBy(notes.createdAt);

  return jsonResponse(results);
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

  const now = new Date().toISOString();

  const [note] = await db
    .insert(notes)
    .values({
      userId: session.user!.id!,
      title: (title as string).trim(),
      content: content as string | undefined,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return jsonResponse(note, 201);
});
