import path from "node:path";
import { and, eq, isNull } from "drizzle-orm";
import { withAuth, jsonResponse, errorResponse } from "@/lib/api";
import { db } from "@/db";
import { notes } from "@/db/schema";
import {
  FrontmatterValidationError,
  parseAndNormalizeNoteFrontmatter,
  parseStoredNoteMetadata,
} from "@/lib/note-frontmatter";

const NOTE_CONTENT_MAX_CHARS = 256000;
const IMPORT_BATCH_MAX_FILES = 100;

type ImportFilePayload = {
  relativePath: string;
  content: string;
};

type NoteResponse = Omit<typeof notes.$inferSelect, "metadata"> & {
  metadata: Record<string, unknown> | null;
};

function toNoteResponse(note: typeof notes.$inferSelect): NoteResponse {
  return {
    ...note,
    metadata: parseStoredNoteMetadata(note.metadata),
  };
}

function normalizeRelativePath(value: string): string {
  const normalized = value.replace(/\\/g, "/").replace(/^\.?\//, "").trim();
  return normalized
    .split("/")
    .filter(Boolean)
    .join("/");
}

function titleFromRelativePath(relativePath: string): string {
  const base = path.posix.basename(relativePath);
  return base.replace(/\.md$/i, "");
}

function folderIdFromRelativePath(relativePath: string): string | null {
  const dirname = path.posix.dirname(relativePath);
  return dirname === "." ? null : dirname;
}

function importedPathFromMetadata(metadata: string | null | undefined): string | null {
  const parsed = parseStoredNoteMetadata(metadata);
  const value = parsed?.importRelativePath;
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

/** POST /api/notes/import — import a batch of markdown files */
export const POST = withAuth(async (req, session) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const files = (body as { files?: unknown })?.files;
  if (!Array.isArray(files) || files.length === 0) {
    return errorResponse("files must be a non-empty array", 400);
  }
  if (files.length > IMPORT_BATCH_MAX_FILES) {
    return errorResponse(`files must contain at most ${IMPORT_BATCH_MAX_FILES} entries`, 400);
  }

  const normalizedFiles: ImportFilePayload[] = [];
  for (const entry of files) {
    if (!entry || typeof entry !== "object") {
      return errorResponse("Each file entry must be an object", 400);
    }

    const { relativePath, content } = entry as Record<string, unknown>;
    if (typeof relativePath !== "string" || relativePath.trim().length === 0) {
      return errorResponse("relativePath is required for each file", 400);
    }
    if (typeof content !== "string") {
      return errorResponse("content must be a string for each file", 400);
    }
    if (content.length > NOTE_CONTENT_MAX_CHARS) {
      return errorResponse(`content must be at most ${NOTE_CONTENT_MAX_CHARS} characters`, 400);
    }

    const normalizedPath = normalizeRelativePath(relativePath);
    if (!normalizedPath.toLowerCase().endsWith(".md")) {
      return errorResponse("Only .md files can be imported", 400);
    }

    normalizedFiles.push({ relativePath: normalizedPath, content });
  }

  const existingNotes = await db
    .select({ metadata: notes.metadata })
    .from(notes)
    .where(and(eq(notes.userId, session.user!.id!), isNull(notes.deletedAt)));
  const existingPaths = new Set(
    existingNotes
      .map((note) => importedPathFromMetadata(note.metadata))
      .filter((value): value is string => Boolean(value)),
  );

  const importedNotes: NoteResponse[] = [];
  const skippedPaths: string[] = [];
  const failures: Array<{ relativePath: string; error: string }> = [];
  const now = new Date().toISOString();

  for (const file of normalizedFiles) {
    if (existingPaths.has(file.relativePath)) {
      skippedPaths.push(file.relativePath);
      continue;
    }

    let frontmatter;
    try {
      frontmatter = parseAndNormalizeNoteFrontmatter(file.content);
    } catch (error) {
      if (error instanceof FrontmatterValidationError) {
        failures.push({
          relativePath: file.relativePath,
          error: error.details[0]?.message ?? "Invalid frontmatter",
        });
        continue;
      }
      throw error;
    }

    const [note] = await db
      .insert(notes)
      .values({
        userId: session.user!.id!,
        title: titleFromRelativePath(file.relativePath),
        content: file.content,
        metadata: JSON.stringify({
          ...(frontmatter.metadata ?? {}),
          importRelativePath: file.relativePath,
          importSource: "folder-import",
          importedAt: now,
        }),
        type: frontmatter.type,
        folderId: folderIdFromRelativePath(file.relativePath),
        projectId: frontmatter.projectId,
        dispatchDate: frontmatter.dispatchDate,
        hasRecurrence: frontmatter.hasRecurrence,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    existingPaths.add(file.relativePath);
    importedNotes.push(toNoteResponse(note));
  }

  return jsonResponse({
    imported: importedNotes.length,
    skipped: skippedPaths.length,
    failed: failures.length,
    importedNotes,
    skippedPaths,
    failures,
  });
});
