import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { NoteEditor } from "@/components/NoteEditor";

export default async function NoteEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { id } = await params;
  const { edit } = await searchParams;

  return (
    <NoteEditor
      noteId={id}
      notesMetadataCollapsedDefault={session.user.notesMetadataCollapsedDefault ?? false}
      startInEditMode={edit === "1"}
    />
  );
}
