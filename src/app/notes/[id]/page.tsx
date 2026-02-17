import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { NoteEditor } from "@/components/NoteEditor";

export default async function NoteEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { id } = await params;

  return (
    <NoteEditor
      noteId={id}
      notesMetadataCollapsedDefault={session.user.notesMetadataCollapsedDefault ?? false}
    />
  );
}
