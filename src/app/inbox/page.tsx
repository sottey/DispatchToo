import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PriorityInboxPage } from "@/components/PriorityInboxPage";

export default async function Inbox() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return <PriorityInboxPage />;
}
