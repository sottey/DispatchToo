import yaml from "js-yaml";
import { z } from "zod";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const knownFrontmatterSchema = z.object({
  type: z.enum(["template", "journal", "meeting", "reference", "dispatch"]).optional(),
  tags: z
    .array(z.string().trim().min(1).max(40))
    .max(25)
    .optional(),
  status: z.enum(["active", "archived", "draft"]).optional(),
  folderId: z.string().trim().min(1).optional(),
  projectId: z.string().trim().min(1).optional(),
  dispatchDate: z
    .string()
    .trim()
    .regex(DATE_REGEX, "dispatchDate must be YYYY-MM-DD")
    .optional(),
  dueDate: z
    .string()
    .trim()
    .regex(DATE_REGEX, "dueDate must be YYYY-MM-DD")
    .optional(),
  pin: z.boolean().optional(),
  reviewIntervalDays: z.coerce.number().int().min(1).max(365).optional(),
  source: z.enum(["manual", "dispatch", "import", "google-calendar"]).optional(),
  sourceId: z.string().trim().min(1).optional(),
  aliases: z
    .array(z.string().trim().min(1).max(80))
    .max(10)
    .optional(),
});

export type NoteFrontmatter = z.infer<typeof knownFrontmatterSchema> & Record<string, unknown>;

export type FrontmatterParseResult = {
  metadata: NoteFrontmatter | null;
  type: string | null;
  folderId: string | null;
  projectId: string | null;
  dispatchDate: string | null;
  hasRecurrence: boolean;
};

export class FrontmatterValidationError extends Error {
  constructor(
    message: string,
    public details: Array<{ path: string; message: string }> = [],
  ) {
    super(message);
    this.name = "FrontmatterValidationError";
  }
}

function normalizeStringArray(values: string[], toLower = false): string[] {
  const normalized = values
    .map((value) => (toLower ? value.trim().toLowerCase() : value.trim()))
    .filter(Boolean);
  return [...new Set(normalized)];
}

function isValidIsoDate(value: string): boolean {
  if (!DATE_REGEX.test(value)) return false;
  const [year, month, day] = value.split("-").map((part) => Number.parseInt(part, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
}

function extractFrontmatterBlock(content: string): string | null {
  const withoutBom = content.startsWith("\uFEFF") ? content.slice(1) : content;
  if (!/^---\r?\n/.test(withoutBom)) return null;
  const lines = withoutBom.split(/\r?\n/);
  if (lines.length < 3) {
    throw new FrontmatterValidationError("Invalid frontmatter", [
      { path: "frontmatter", message: "Missing closing frontmatter delimiter" },
    ]);
  }

  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) {
    throw new FrontmatterValidationError("Invalid frontmatter", [
      { path: "frontmatter", message: "Missing closing frontmatter delimiter" },
    ]);
  }

  return lines.slice(1, endIndex).join("\n");
}

function normalizeAndValidateKnownFields(input: z.infer<typeof knownFrontmatterSchema>): z.infer<typeof knownFrontmatterSchema> {
  const normalized: z.infer<typeof knownFrontmatterSchema> = { ...input };

  if (normalized.tags) {
    normalized.tags = normalizeStringArray(normalized.tags, true);
  }

  if (normalized.aliases) {
    normalized.aliases = normalizeStringArray(normalized.aliases, false);
  }

  if (normalized.dispatchDate && !isValidIsoDate(normalized.dispatchDate)) {
    throw new FrontmatterValidationError("Invalid frontmatter", [
      { path: "dispatchDate", message: "dispatchDate must be a real date" },
    ]);
  }

  if (normalized.dueDate && !isValidIsoDate(normalized.dueDate)) {
    throw new FrontmatterValidationError("Invalid frontmatter", [
      { path: "dueDate", message: "dueDate must be a real date" },
    ]);
  }

  return normalized;
}

function parseFrontmatterObject(content: string): NoteFrontmatter | null {
  const frontmatterBlock = extractFrontmatterBlock(content);
  if (frontmatterBlock === null) return null;

  let parsed: unknown;
  try {
    parsed = yaml.load(frontmatterBlock);
  } catch (error) {
    throw new FrontmatterValidationError("Invalid frontmatter", [
      {
        path: "frontmatter",
        message: error instanceof Error ? error.message : "Failed to parse YAML",
      },
    ]);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new FrontmatterValidationError("Invalid frontmatter", [
      { path: "frontmatter", message: "Frontmatter must be a YAML object" },
    ]);
  }

  const rawObject = parsed as Record<string, unknown>;
  if ("recurrence" in rawObject) {
    throw new FrontmatterValidationError("Invalid frontmatter", [
      { path: "recurrence", message: "recurrence is not supported in note frontmatter" },
    ]);
  }
  const knownInput: Record<string, unknown> = {};
  const unknownOutput: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(rawObject)) {
    if (key in knownFrontmatterSchema.shape) {
      knownInput[key] = value;
    } else {
      unknownOutput[key] = value;
    }
  }

  const knownResult = knownFrontmatterSchema.safeParse(knownInput);
  if (!knownResult.success) {
    throw new FrontmatterValidationError(
      "Invalid frontmatter",
      knownResult.error.issues.map((issue) => ({
        path: issue.path.join(".") || "frontmatter",
        message: issue.message,
      })),
    );
  }

  const normalizedKnown = normalizeAndValidateKnownFields(knownResult.data);
  return {
    ...unknownOutput,
    ...normalizedKnown,
  };
}

export function parseAndNormalizeNoteFrontmatter(content: string | null | undefined): FrontmatterParseResult {
  if (!content) {
    return {
      metadata: null,
      type: null,
      folderId: null,
      projectId: null,
      dispatchDate: null,
      hasRecurrence: false,
    };
  }

  const metadata = parseFrontmatterObject(content);
  if (!metadata) {
    return {
      metadata: null,
      type: null,
      folderId: null,
      projectId: null,
      dispatchDate: null,
      hasRecurrence: false,
    };
  }

  return {
    metadata,
    type: typeof metadata.type === "string" ? metadata.type : null,
    folderId: typeof metadata.folderId === "string" ? metadata.folderId : null,
    projectId: typeof metadata.projectId === "string" ? metadata.projectId : null,
    dispatchDate: typeof metadata.dispatchDate === "string" ? metadata.dispatchDate : null,
    hasRecurrence: false,
  };
}

export function parseStoredNoteMetadata(metadata: string | null | undefined): NoteFrontmatter | null {
  if (!metadata) return null;
  try {
    const parsed = JSON.parse(metadata);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as NoteFrontmatter;
  } catch {
    return null;
  }
}
