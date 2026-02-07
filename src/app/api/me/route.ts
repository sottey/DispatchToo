import { withAuth, jsonResponse } from "@/lib/api";

export const GET = withAuth(async (_req, session) => {
  return jsonResponse({ user: session.user });
}, { allowApiKey: false });
