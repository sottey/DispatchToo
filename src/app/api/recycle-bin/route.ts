import { withAuth, jsonResponse, errorResponse } from "@/lib/api";
import { db } from "@/db";
import { tasks, notes, projects } from "@/db/schema";
import { eq, and, isNotNull, lt } from "drizzle-orm";

const RETENTION_DAYS = 30;

interface RecycleBinItem {
  id: string;
  type: "task" | "note" | "project";
  title: string;
  deletedAt: string;
}

/** GET /api/recycle-bin — list all soft-deleted items for the current user */
export const GET = withAuth(async (req, session) => {
  const userId = session.user!.id!;

  // Auto-purge items older than 30 days before listing
  await purgeExpired(userId);

  const [deletedTasks, deletedNotes, deletedProjects] = await Promise.all([
    db
      .select({
        id: tasks.id,
        title: tasks.title,
        deletedAt: tasks.deletedAt,
        description: tasks.description,
        status: tasks.status,
        priority: tasks.priority,
      })
      .from(tasks)
      .where(and(eq(tasks.userId, userId), isNotNull(tasks.deletedAt))),

    db
      .select({
        id: notes.id,
        title: notes.title,
        deletedAt: notes.deletedAt,
      })
      .from(notes)
      .where(and(eq(notes.userId, userId), isNotNull(notes.deletedAt))),

    db
      .select({
        id: projects.id,
        name: projects.name,
        deletedAt: projects.deletedAt,
        description: projects.description,
        color: projects.color,
      })
      .from(projects)
      .where(and(eq(projects.userId, userId), isNotNull(projects.deletedAt))),
  ]);

  const items: RecycleBinItem[] = [
    ...deletedTasks.map((t) => ({
      id: t.id,
      type: "task" as const,
      title: t.title,
      deletedAt: t.deletedAt!,
      meta: { description: t.description, status: t.status, priority: t.priority },
    })),
    ...deletedNotes.map((n) => ({
      id: n.id,
      type: "note" as const,
      title: n.title,
      deletedAt: n.deletedAt!,
    })),
    ...deletedProjects.map((p) => ({
      id: p.id,
      type: "project" as const,
      title: p.name,
      deletedAt: p.deletedAt!,
      meta: { description: p.description, color: p.color },
    })),
  ];

  // Sort by most recently deleted first
  items.sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());

  return jsonResponse({ items, retentionDays: RETENTION_DAYS });
});

/** POST /api/recycle-bin — restore or permanently delete an item */
export const POST = withAuth(async (req, session) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const { id, type, action } = body as Record<string, unknown>;

  if (!id || typeof id !== "string") {
    return errorResponse("id is required and must be a string", 400);
  }

  if (!type || !["task", "note", "project"].includes(type as string)) {
    return errorResponse("type must be one of: task, note, project", 400);
  }

  if (!action || !["restore", "delete"].includes(action as string)) {
    return errorResponse("action must be one of: restore, delete", 400);
  }

  const userId = session.user!.id!;
  const now = new Date().toISOString();

  if (type === "task") {
    const [existing] = await db
      .select({ id: tasks.id, deletedAt: tasks.deletedAt })
      .from(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.userId, userId), isNotNull(tasks.deletedAt)));

    if (!existing) {
      return errorResponse("Item not found in recycle bin", 404);
    }

    if (action === "restore") {
      await db.update(tasks).set({ deletedAt: null, updatedAt: now }).where(eq(tasks.id, id));
      return jsonResponse({ restored: true });
    } else {
      await db.delete(tasks).where(eq(tasks.id, id));
      return jsonResponse({ permanentlyDeleted: true });
    }
  }

  if (type === "note") {
    const [existing] = await db
      .select({ id: notes.id, deletedAt: notes.deletedAt })
      .from(notes)
      .where(and(eq(notes.id, id), eq(notes.userId, userId), isNotNull(notes.deletedAt)));

    if (!existing) {
      return errorResponse("Item not found in recycle bin", 404);
    }

    if (action === "restore") {
      await db.update(notes).set({ deletedAt: null, updatedAt: now }).where(eq(notes.id, id));
      return jsonResponse({ restored: true });
    } else {
      await db.delete(notes).where(eq(notes.id, id));
      return jsonResponse({ permanentlyDeleted: true });
    }
  }

  if (type === "project") {
    const [existing] = await db
      .select({ id: projects.id, deletedAt: projects.deletedAt })
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, userId), isNotNull(projects.deletedAt)));

    if (!existing) {
      return errorResponse("Item not found in recycle bin", 404);
    }

    if (action === "restore") {
      await db.update(projects).set({ deletedAt: null, updatedAt: now }).where(eq(projects.id, id));
      return jsonResponse({ restored: true });
    } else {
      await db.delete(projects).where(eq(projects.id, id));
      return jsonResponse({ permanentlyDeleted: true });
    }
  }

  return errorResponse("Invalid type", 400);
});

/** Permanently delete items that have been in the recycle bin for more than RETENTION_DAYS */
async function purgeExpired(userId: string) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
  const cutoffStr = cutoff.toISOString();

  await Promise.all([
    db.delete(tasks).where(and(eq(tasks.userId, userId), isNotNull(tasks.deletedAt), lt(tasks.deletedAt, cutoffStr))),
    db.delete(notes).where(and(eq(notes.userId, userId), isNotNull(notes.deletedAt), lt(notes.deletedAt, cutoffStr))),
    db.delete(projects).where(and(eq(projects.userId, userId), isNotNull(projects.deletedAt), lt(projects.deletedAt, cutoffStr))),
  ]);
}
