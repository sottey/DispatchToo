import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Dashboard } from "@/components/Dashboard";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return <Dashboard userName={session.user.name ?? "there"} />;
}
