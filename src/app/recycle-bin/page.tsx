import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { RecycleBinPage } from "@/components/RecycleBinPage";

export default async function RecycleBin() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return <RecycleBinPage />;
}
