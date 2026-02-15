import { withAuth, jsonResponse, errorResponse } from "@/lib/api";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { db } from "@/db";
import { projects, tasks } from "@/db/schema";
import { eq, and, sql, isNull } from "drizzle-orm";

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/projects/[id]/tasks — list tasks for a project */
export const GET = withAuth(async (req, session, ctx) => {
  const { id } = await (ctx as RouteContext).params;

  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, session.user!.id!)));

  if (!project) {
    return errorResponse("Project not found", 404);
  }

  const where = and(eq(tasks.userId, session.user!.id!), eq(tasks.projectId, id), isNull(tasks.deletedAt));
  const pagination = parsePagination(new URL(req.url));

  if (pagination) {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tasks)
      .where(where);

    const results = await db
      .select()
      .from(tasks)
      .where(where)
      .orderBy(tasks.createdAt)
      .limit(pagination.limit)
      .offset((pagination.page - 1) * pagination.limit);

    return jsonResponse(paginatedResponse(results, count, pagination));
  }

  const results = await db
    .select()
    .from(tasks)
    .where(where)
    .orderBy(tasks.createdAt);

  return jsonResponse(results);
});
