import { withAuth, jsonResponse, errorResponse } from "@/lib/api";
import { db } from "@/db";
import { dispatches } from "@/db/schema";
import { addDaysToDateKey } from "@/lib/datetime";
import { eq, and } from "drizzle-orm";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/dispatches/[id]/unfinalize — reopen a finalized dispatch for editing.
 * Sets finalized to false and returns info about whether tasks were rolled to next day.
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

  if (!dispatch.finalized) {
    return errorResponse("Dispatch is not finalized", 400);
  }

  // Calculate next day's date (same logic as complete endpoint)
  const nextDate = addDaysToDateKey(dispatch.date, 1);

  // Check if next day's dispatch exists
  const [nextDispatch] = await db
    .select()
    .from(dispatches)
    .where(and(eq(dispatches.userId, userId), eq(dispatches.date, nextDate)));

  // Unfinalize the dispatch
  const [updated] = await db
    .update(dispatches)
    .set({ finalized: false, updatedAt: new Date().toISOString() })
    .where(eq(dispatches.id, id))
    .returning();

  return jsonResponse({
    dispatch: updated,
    hasNextDispatch: !!nextDispatch,
    nextDispatchDate: nextDispatch?.date ?? null,
  });
});
