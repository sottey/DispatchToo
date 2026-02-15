import { withAuth, jsonResponse, errorResponse } from "@/lib/api";
import { db } from "@/db";
import { dispatches, dispatchTasks } from "@/db/schema";
import { endOfMonthDateKey } from "@/lib/datetime";
import { eq, and, gte, lte, inArray, sql } from "drizzle-orm";

/**
 * GET /api/dispatches/calendar?year=2026&month=2
 * Returns dispatch metadata for a calendar view (month).
 */
export const GET = withAuth(async (req, session) => {
  const userId = session.user!.id!;
  const url = new URL(req.url);
  const yearStr = url.searchParams.get("year");
  const monthStr = url.searchParams.get("month");

  if (!yearStr || !monthStr) {
    return errorResponse("Missing year or month parameter", 400);
  }

  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return errorResponse("Invalid year or month", 400);
  }

  const startDateStr = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDateStr = endOfMonthDateKey(year, month);

  // Fetch dispatches for the month
  const monthDispatches = await db
    .select({
      id: dispatches.id,
      date: dispatches.date,
      finalized: dispatches.finalized,
    })
    .from(dispatches)
    .where(
      and(
        eq(dispatches.userId, userId),
        gte(dispatches.date, startDateStr),
        lte(dispatches.date, endDateStr)
      )
    );

  // Get task counts for each dispatch
  const dispatchIds = monthDispatches.map((d) => d.id);
  const taskCounts = dispatchIds.length > 0
    ? await db
        .select({
          dispatchId: dispatchTasks.dispatchId,
          count: sql<number>`count(*)`.as("count"),
        })
        .from(dispatchTasks)
        .where(inArray(dispatchTasks.dispatchId, dispatchIds))
        .groupBy(dispatchTasks.dispatchId)
    : [];

  // Build response map
  const dates: Record<string, { finalized: boolean; taskCount: number }> = {};
  for (const dispatch of monthDispatches) {
    const taskCount = taskCounts.find((tc) => tc.dispatchId === dispatch.id)?.count ?? 0;
    dates[dispatch.date] = {
      finalized: dispatch.finalized,
      taskCount,
    };
  }

  return jsonResponse({ dates });
});
