import { withAuth, jsonResponse, errorResponse } from "@/lib/api";
import { db } from "@/db";
import { tasks, notes, dispatches, projects } from "@/db/schema";
import { eq, and, or, like, sql, isNull } from "drizzle-orm";

const MAX_PER_CATEGORY = 10;

function escapeLike(str: string): string {
  return str.replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/** GET /api/search?q=<query> — search across tasks, notes, dispatches, and projects */
export const GET = withAuth(async (req, session) => {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();

  if (!q || q.length < 1) {
    return errorResponse("Query parameter 'q' is required", 400);
  }

  if (q.length > 200) {
    return errorResponse("Query too long (max 200 characters)", 400);
  }

  const userId = session.user!.id!;
  const pattern = `%${escapeLike(q.toLowerCase())}%`;

  const [matchedTasks, matchedNotes, matchedDispatches, matchedProjects] = await Promise.all([
    db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, userId),
          isNull(tasks.deletedAt),
          or(
            like(sql`LOWER(${tasks.title})`, pattern),
            like(sql`LOWER(${tasks.description})`, pattern),
          ),
        ),
      )
      .limit(MAX_PER_CATEGORY),

    db
      .select()
      .from(notes)
      .where(
        and(
          eq(notes.userId, userId),
          isNull(notes.deletedAt),
          or(
            like(sql`LOWER(${notes.title})`, pattern),
            like(sql`LOWER(${notes.content})`, pattern),
          ),
        ),
      )
      .limit(MAX_PER_CATEGORY),

    db
      .select()
      .from(dispatches)
      .where(
        and(
          eq(dispatches.userId, userId),
          like(sql`LOWER(${dispatches.summary})`, pattern),
        ),
      )
      .limit(MAX_PER_CATEGORY),

    db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.userId, userId),
          isNull(projects.deletedAt),
          or(
            like(sql`LOWER(${projects.name})`, pattern),
            like(sql`LOWER(${projects.description})`, pattern),
          ),
        ),
      )
      .limit(MAX_PER_CATEGORY),
  ]);

  return jsonResponse({
    tasks: matchedTasks,
    notes: matchedNotes,
    dispatches: matchedDispatches,
    projects: matchedProjects,
  });
});
