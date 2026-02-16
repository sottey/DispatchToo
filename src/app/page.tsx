import { auth } from "@/auth";
import { redirect } from "next/navigation";

const START_NODE_ROUTE: Record<
  "dashboard" | "dispatch" | "inbox" | "tasks" | "notes" | "insights" | "projects",
  string
> = {
  dashboard: "/dashboard",
  dispatch: "/dispatch",
  inbox: "/inbox",
  tasks: "/tasks",
  notes: "/notes",
  insights: "/insights",
  projects: "/projects",
};

export default async function Home() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const defaultStartNode = session.user.defaultStartNode ?? "dashboard";
  const target = START_NODE_ROUTE[defaultStartNode] ?? "/";
  redirect(target);
}
