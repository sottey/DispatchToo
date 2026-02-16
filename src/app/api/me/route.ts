import { withAuth, jsonResponse, errorResponse } from "@/lib/api";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export const GET = withAuth(async (_req, session) => {
  return jsonResponse({ user: session.user });
}, { allowApiKey: false });

export const PUT = withAuth(async (req, session) => {
  const VALID_DEFAULT_START_NODES = new Set([
    "dashboard",
    "dispatch",
    "inbox",
    "tasks",
    "notes",
    "insights",
    "projects",
  ]);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const { showAdminQuickAccess, assistantEnabled, tasksTodayFocusDefault, defaultStartNode } = body as Record<string, unknown>;

  if (showAdminQuickAccess !== undefined && typeof showAdminQuickAccess !== "boolean") {
    return errorResponse("showAdminQuickAccess must be a boolean", 400);
  }

  if (assistantEnabled !== undefined && typeof assistantEnabled !== "boolean") {
    return errorResponse("assistantEnabled must be a boolean", 400);
  }

  if (tasksTodayFocusDefault !== undefined && typeof tasksTodayFocusDefault !== "boolean") {
    return errorResponse("tasksTodayFocusDefault must be a boolean", 400);
  }

  if (
    defaultStartNode !== undefined &&
    (typeof defaultStartNode !== "string" || !VALID_DEFAULT_START_NODES.has(defaultStartNode))
  ) {
    return errorResponse(
      "defaultStartNode must be one of: dashboard, dispatch, inbox, tasks, notes, insights, projects",
      400,
    );
  }

  if (
    showAdminQuickAccess === undefined &&
    assistantEnabled === undefined &&
    tasksTodayFocusDefault === undefined &&
    defaultStartNode === undefined
  ) {
    return errorResponse("At least one preference field is required", 400);
  }

  const updates: Record<string, unknown> = {};
  if (showAdminQuickAccess !== undefined) updates.showAdminQuickAccess = showAdminQuickAccess;
  if (assistantEnabled !== undefined) updates.assistantEnabled = assistantEnabled;
  if (tasksTodayFocusDefault !== undefined) updates.tasksTodayFocusDefault = tasksTodayFocusDefault;
  if (defaultStartNode !== undefined) updates.defaultStartNode = defaultStartNode;

  const [updated] = await db
    .update(users)
    .set(updates)
    .where(eq(users.id, session.user.id))
    .returning({
      showAdminQuickAccess: users.showAdminQuickAccess,
      assistantEnabled: users.assistantEnabled,
      tasksTodayFocusDefault: users.tasksTodayFocusDefault,
      defaultStartNode: users.defaultStartNode,
    });

  return jsonResponse({
    showAdminQuickAccess:
      updated?.showAdminQuickAccess ?? (showAdminQuickAccess as boolean | undefined) ?? true,
    assistantEnabled:
      updated?.assistantEnabled ?? (assistantEnabled as boolean | undefined) ?? true,
    tasksTodayFocusDefault:
      updated?.tasksTodayFocusDefault ?? (tasksTodayFocusDefault as boolean | undefined) ?? false,
    defaultStartNode:
      updated?.defaultStartNode ?? (defaultStartNode as string | undefined) ?? "dashboard",
  });
}, { allowApiKey: false });
