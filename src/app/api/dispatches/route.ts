import { withAuth, jsonResponse, errorResponse } from "@/lib/api";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { db } from "@/db";
import { dispatches } from "@/db/schema";
import { getOrCreateDispatchForDate } from "@/lib/dispatch-template";
import { eq, and, sql } from "drizzle-orm";

/** GET /api/dispatches — list dispatches for the current user */
export const GET = withAuth(async (req, session) => {
  const url = new URL(req.url);
  const date = url.searchParams.get("date");

  const conditions = [eq(dispatches.userId, session.user!.id!)];

  if (date) {
    conditions.push(eq(dispatches.date, date));
  }

  const where = and(...conditions);
  const pagination = parsePagination(url);

  if (pagination) {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(dispatches)
      .where(where);

    const results = await db
      .select()
      .from(dispatches)
      .where(where)
      .orderBy(dispatches.date)
      .limit(pagination.limit)
      .offset((pagination.page - 1) * pagination.limit);

    return jsonResponse(paginatedResponse(results, count, pagination));
  }

  const results = await db
    .select()
    .from(dispatches)
    .where(where)
    .orderBy(dispatches.date);

  return jsonResponse(results);
});

/** POST /api/dispatches — create a new dispatch */
export const POST = withAuth(async (req, session) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const { date, summary } = body as Record<string, unknown>;

  if (!date || typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return errorResponse("date is required and must be in YYYY-MM-DD format", 400);
  }

  if (summary !== undefined && typeof summary !== "string") {
    return errorResponse("summary must be a string", 400);
  }

  // Check for existing dispatch on same date for this user
  const [existing] = await db
    .select({ id: dispatches.id })
    .from(dispatches)
    .where(and(eq(dispatches.userId, session.user!.id!), eq(dispatches.date, date)));

  if (existing) {
    return errorResponse("A dispatch already exists for this date", 409);
  }

  const { dispatch } = await getOrCreateDispatchForDate(session.user!.id!, date);

  if (summary !== undefined) {
    const [updated] = await db
      .update(dispatches)
      .set({ summary: summary as string, updatedAt: new Date().toISOString() })
      .where(eq(dispatches.id, dispatch.id))
      .returning();
    return jsonResponse(updated ?? dispatch, 201);
  }

  return jsonResponse(dispatch, 201);
});
