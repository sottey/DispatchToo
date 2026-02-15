import { withAuth, jsonResponse, errorResponse } from "@/lib/api";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { eq, and } from "drizzle-orm";

type RouteContext = { params: Promise<{ id: string }> };

/** DELETE /api/api-keys/[id] — delete an API key */
export const DELETE = withAuth(async (req, session, ctx: RouteContext) => {
  const { id } = await ctx.params;

  if (!id || typeof id !== "string") {
    return errorResponse("id is required", 400);
  }

  const [existing] = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, session.user!.id!)))
    .limit(1);

  if (!existing) {
    return errorResponse("API key not found", 404);
  }

  await db.delete(apiKeys).where(eq(apiKeys.id, id));

  return jsonResponse({ success: true });
}, { allowApiKey: false });
