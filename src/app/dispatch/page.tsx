import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { DispatchPage } from "@/components/DispatchPage";

export default async function Dispatch() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return <DispatchPage showDispatchHelpDefault={session.user.showDispatchHelp ?? true} />;
}
