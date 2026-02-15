import { withAuth, jsonResponse, errorResponse } from "@/lib/api";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { eq } from "drizzle-orm";

/** GET /api/api-keys — list API keys for the current user */
export const GET = withAuth(async (req, session) => {
  const results = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      key: apiKeys.key,
      lastUsedAt: apiKeys.lastUsedAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.userId, session.user!.id!))
    .orderBy(apiKeys.createdAt);

  return jsonResponse(results);
}, { allowApiKey: false });

/** POST /api/api-keys — create a new API key */
export const POST = withAuth(async (req, session) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const { name } = body as Record<string, unknown>;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return errorResponse("name is required and must be a non-empty string", 400);
  }

  if ((name as string).length > 100) {
    return errorResponse("name must be at most 100 characters", 400);
  }

  // Generate a secure random API key using Web Crypto API
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const key = `dp_${Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')}`;
  const now = new Date().toISOString();

  const [apiKey] = await db
    .insert(apiKeys)
    .values({
      userId: session.user!.id!,
      name: (name as string).trim(),
      key,
      createdAt: now,
    })
    .returning();

  return jsonResponse(apiKey, 201);
}, { allowApiKey: false });
