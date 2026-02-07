import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { apiKeys, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { Session } from "next-auth";

type AuthOptions = {
  allowApiKey?: boolean;
};

function getApiKeyFromRequest(req: Request): string | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader) {
    const [scheme, rawToken] = authHeader.split(" ");
    if (scheme?.toLowerCase() === "bearer" && rawToken) {
      const token = rawToken.trim();
      if (token.length > 0) return token;
    }
  }

  const xApiKey = req.headers.get("x-api-key");
  if (xApiKey && xApiKey.trim().length > 0) {
    return xApiKey.trim();
  }

  return null;
}

async function resolveApiKeySession(req: Request): Promise<Session | null> {
  const token = getApiKeyFromRequest(req);
  if (!token) return null;

  const [result] = await db
    .select({
      apiKeyId: apiKeys.id,
      userId: apiKeys.userId,
      name: users.name,
      email: users.email,
      image: users.image,
    })
    .from(apiKeys)
    .innerJoin(users, eq(apiKeys.userId, users.id))
    .where(eq(apiKeys.key, token))
    .limit(1);

  if (!result) return null;

  await db
    .update(apiKeys)
    .set({ lastUsedAt: new Date().toISOString() })
    .where(eq(apiKeys.id, result.apiKeyId));

  return {
    user: {
      id: result.userId,
      name: result.name,
      email: result.email,
      image: result.image,
    },
    expires: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  };
}

/**
 * Wraps an API route handler with authentication.
 * Returns 401 if the user is not authenticated.
 * Passes through the route context (contains `params` for dynamic segments).
 */
export function withAuth<TCtx = unknown>(
  handler: (req: Request, session: Session, ctx: TCtx) => Promise<NextResponse>,
  options: AuthOptions = {}
) {
  return async (req: Request, ctx: TCtx) => {
    const { allowApiKey = true } = options;

    const session = await auth();
    if (session?.user) {
      return handler(req, session, ctx);
    }

    if (allowApiKey) {
      const apiKeySession = await resolveApiKeySession(req);
      if (apiKeySession?.user) {
        return handler(req, apiKeySession, ctx);
      }
    }

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return handler(req, session, ctx);
  };
}

/**
 * Standard JSON error response.
 */
export function errorResponse(message: string, status: number = 500) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Standard JSON success response.
 */
export function jsonResponse<T>(data: T, status: number = 200) {
  return NextResponse.json(data, { status });
}
