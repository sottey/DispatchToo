"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api, type Note } from "@/lib/client";
import { Pagination } from "@/components/Pagination";
import { useToast } from "@/components/ToastProvider";

export function NotesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.notes.list({
        search: search || undefined,
        page,
        limit: 20,
      });
      if (Array.isArray(data)) {
        setNotes(data);
        setTotalPages(1);
      } else {
        setNotes(data.data);
        setTotalPages(data.pagination.totalPages);
      }
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    const timeout = setTimeout(fetchNotes, search ? 300 : 0);
    return () => clearTimeout(timeout);
  }, [fetchNotes, search]);

  // Reset page on search change
  useEffect(() => {
    setPage(1);
  }, [search]);

  // Listen for keyboard shortcut to create new note
  useEffect(() => {
    window.addEventListener("shortcut:new-note", handleCreate);
    return () => window.removeEventListener("shortcut:new-note", handleCreate);
  }, []);

  async function handleCreate() {
    try {
      const note = await api.notes.create({ title: "Untitled Note" });
      router.push(`/notes/${note.id}`);
    } catch {
      toast.error("Failed to create note");
    }
  }

  async function handleDelete(id: string) {
    const prev = notes;
    setNotes((n) => n.filter((x) => x.id !== id));
    try {
      await api.notes.delete(id);
      toast.success("Note deleted");
    } catch {
      setNotes(prev);
      toast.error("Failed to delete note");
    }
  }

  const sorted = [...notes].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold dark:text-white">Notes</h1>
        <button
          onClick={handleCreate}
          className="rounded-lg bg-gray-900 dark:bg-gray-100 px-4 py-2 text-sm font-medium text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
        >
          New Note
        </button>
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search notes by title..."
        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-sm dark:text-white focus:border-gray-900 dark:focus:border-gray-400 focus:outline-none"
      />

      {/* Notes grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-12 text-center text-gray-400 dark:text-gray-500">
          {search ? "No notes match your search." : "No notes yet."}{" "}
          {!search && (
            <button onClick={handleCreate} className="text-blue-600 dark:text-blue-400 hover:underline">
              Create one
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onClick={() => router.push(`/notes/${note.id}`)}
              onDelete={() => handleDelete(note.id)}
            />
          ))}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}

function NoteCard({
  note,
  onClick,
  onDelete,
}: {
  note: Note;
  onClick: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="group relative rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 hover:border-gray-300 dark:hover:border-gray-600 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute top-2 right-2 text-xs text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        Delete
      </button>
      <h3 className="font-medium text-sm truncate dark:text-white">{note.title}</h3>
      {note.content && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 line-clamp-3">{note.content}</p>
      )}
      <p className="text-xs text-gray-300 dark:text-gray-600 mt-3">
        {new Date(note.updatedAt).toLocaleDateString()}
      </p>
    </div>
  );
}
