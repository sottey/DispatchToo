import { withAuth, jsonResponse, errorResponse } from "@/lib/api";
import { db } from "@/db";
import { dispatches, dispatchTasks, tasks } from "@/db/schema";
import { eq, and, ne } from "drizzle-orm";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/dispatches/[id]/complete — finalize a dispatch.
 * Marks the dispatch as finalized and rolls unfinished linked tasks
 * to the next day's dispatch (creating it if needed).
 */
export const POST = withAuth(async (req, session, ctx) => {
  const { id } = await (ctx as RouteContext).params;
  const userId = session.user!.id!;

  // Verify dispatch belongs to user
  const [dispatch] = await db
    .select()
    .from(dispatches)
    .where(and(eq(dispatches.id, id), eq(dispatches.userId, userId)));

  if (!dispatch) {
    return errorResponse("Dispatch not found", 404);
  }

  if (dispatch.finalized) {
    return errorResponse("Dispatch is already finalized", 400);
  }

  // Find unfinished tasks linked to this dispatch
  const linkedTasks = await db
    .select({
      id: tasks.id,
      status: tasks.status,
    })
    .from(dispatchTasks)
    .innerJoin(tasks, eq(dispatchTasks.taskId, tasks.id))
    .where(eq(dispatchTasks.dispatchId, id));

  const unfinished = linkedTasks.filter((t) => t.status !== "done");

  // Calculate next day
  const currentDate = new Date(dispatch.date + "T00:00:00");
  currentDate.setDate(currentDate.getDate() + 1);
  const nextDate = currentDate.toISOString().split("T")[0];

  const now = new Date().toISOString();

  // Finalize current dispatch
  const [finalized] = await db
    .update(dispatches)
    .set({ finalized: true, updatedAt: now })
    .where(eq(dispatches.id, id))
    .returning();

  // Roll unfinished tasks to next day if any
  let nextDispatch = null;
  if (unfinished.length > 0) {
    // Find or create next day's dispatch
    const [existing] = await db
      .select()
      .from(dispatches)
      .where(and(eq(dispatches.userId, userId), eq(dispatches.date, nextDate)));

    if (existing) {
      nextDispatch = existing;
    } else {
      const [created] = await db
        .insert(dispatches)
        .values({
          userId,
          date: nextDate,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      nextDispatch = created;
    }

    // Link unfinished tasks to the next dispatch (skip if already linked)
    for (const task of unfinished) {
      const [existingLink] = await db
        .select()
        .from(dispatchTasks)
        .where(
          and(
            eq(dispatchTasks.dispatchId, nextDispatch.id),
            eq(dispatchTasks.taskId, task.id),
          ),
        );
      if (!existingLink) {
        await db
          .insert(dispatchTasks)
          .values({ dispatchId: nextDispatch.id, taskId: task.id });
      }
    }
  }

  return jsonResponse({
    dispatch: finalized,
    rolledOver: unfinished.length,
    nextDispatchId: nextDispatch?.id ?? null,
  });
});
