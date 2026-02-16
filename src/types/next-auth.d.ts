import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "member" | "admin";
      isFrozen: boolean;
      showAdminQuickAccess: boolean;
      assistantEnabled: boolean;
      tasksTodayFocusDefault: boolean;
      defaultStartNode: "dashboard" | "dispatch" | "inbox" | "tasks" | "notes" | "insights" | "projects";
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }

  interface User {
    role?: "member" | "admin";
    isFrozen?: boolean;
    showAdminQuickAccess?: boolean;
    assistantEnabled?: boolean;
    tasksTodayFocusDefault?: boolean;
    defaultStartNode?: "dashboard" | "dispatch" | "inbox" | "tasks" | "notes" | "insights" | "projects";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "member" | "admin";
    isFrozen?: boolean;
    showAdminQuickAccess?: boolean;
    assistantEnabled?: boolean;
    tasksTodayFocusDefault?: boolean;
    defaultStartNode?: "dashboard" | "dispatch" | "inbox" | "tasks" | "notes" | "insights" | "projects";
    provider?: string;
  }
}
