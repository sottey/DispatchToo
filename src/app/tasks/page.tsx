import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { TasksPage } from "@/components/TasksPage";

export default async function Tasks() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return <TasksPage />;
}
