import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ProjectsPage } from "@/components/ProjectsPage";

export default async function Projects() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return <ProjectsPage />;
}
