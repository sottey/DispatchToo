import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { NotesPage } from "@/components/NotesPage";

export default async function Notes() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return <NotesPage />;
}
