import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { InsightsPage } from "@/components/InsightsPage";

export default async function Insights() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return <InsightsPage />;
}
