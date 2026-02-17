import { withAuth, jsonResponse } from "@/lib/api";
import { db } from "@/db";
import { notes } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { parseAndNormalizeNoteFrontmatter, parseStoredNoteMetadata } from "@/lib/note-frontmatter";

export const GET = withAuth(async (_req, session) => {
  const rows = await db
    .select({ metadata: notes.metadata, content: notes.content })
    .from(notes)
    .where(and(eq(notes.userId, session.user.id), isNull(notes.deletedAt)));

  const counts = new Map<string, number>();

  for (const row of rows) {
    const metadata = parseStoredNoteMetadata(row.metadata) ??
      (typeof row.content === "string" && row.content.length > 0
        ? (() => {
            try {
              return parseAndNormalizeNoteFrontmatter(row.content).metadata;
            } catch {
              return null;
            }
          })()
        : null);
    if (!metadata) continue;

    const tagsValue = Object.entries(metadata).find(([key]) => {
      const normalized = key.trim().toLowerCase();
      return normalized === "tags" || normalized === "tag" || normalized === "keywords";
    })?.[1];

    const tags = Array.isArray(tagsValue)
      ? tagsValue
      : typeof tagsValue === "string"
        ? tagsValue.split(",")
        : [];

    for (const entry of tags) {
      if (typeof entry !== "string") continue;
      const tag = entry.trim().toLowerCase();
      if (!tag) continue;
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  const result = [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.tag.localeCompare(b.tag);
    });

  return jsonResponse(result);
});
