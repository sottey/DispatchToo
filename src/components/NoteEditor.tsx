"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Markdown from "react-markdown";
import { api, type Note } from "@/lib/client";
import { useToast } from "@/components/ToastProvider";

export function NoteEditor({ noteId }: { noteId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    api.notes
      .get(noteId)
      .then((n) => {
        setNote(n);
        setTitle(n.title);
        setContent(n.content ?? "");
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [noteId]);

  const save = useCallback(
    async (t: string, c: string) => {
      setSaving(true);
      try {
        const updated = await api.notes.update(noteId, {
          title: t.trim() || "Untitled Note",
          content: c,
        });
        setNote(updated);
      } catch {
        toast.error("Failed to save note");
      } finally {
        setSaving(false);
      }
    },
    [noteId],
  );

  // Auto-save on changes (debounced 1s)
  function handleChange(newTitle: string, newContent: string) {
    setTitle(newTitle);
    setContent(newContent);
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => save(newTitle, newContent), 1000);
  }

  async function handleDelete() {
    if (!note) return;
    await api.notes.delete(note.id);
    toast.success("Note deleted");
    router.push("/notes");
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-96 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-4xl p-6 text-center">
        <h1 className="text-2xl font-bold dark:text-white">Note not found</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          This note may have been deleted.{" "}
          <button
            onClick={() => router.push("/notes")}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            Back to notes
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push("/notes")}
          className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        >
          &larr; Back to notes
        </button>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {saving ? "Saving..." : "Saved"}
          </span>
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
              showPreview
                ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
                : "border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            }`}
          >
            {showPreview ? "Edit" : "Preview"}
          </button>
          <button
            onClick={handleDelete}
            className="rounded-lg px-3 py-1.5 text-sm text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Title */}
      <input
        type="text"
        value={title}
        onChange={(e) => handleChange(e.target.value, content)}
        placeholder="Note title..."
        className="w-full text-2xl font-bold border-none outline-none bg-transparent dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-600"
      />

      {/* Editor / Preview */}
      {showPreview ? (
        <div className="prose prose-sm dark:prose-invert max-w-none rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 min-h-[400px]">
          {content ? (
            <Markdown>{content}</Markdown>
          ) : (
            <p className="text-gray-300 dark:text-gray-600 italic">Nothing to preview.</p>
          )}
        </div>
      ) : (
        <textarea
          value={content}
          onChange={(e) => handleChange(title, e.target.value)}
          placeholder="Write your note in markdown..."
          className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 text-sm font-mono dark:text-gray-200 min-h-[400px] resize-y focus:border-gray-900 dark:focus:border-gray-500 focus:outline-none"
        />
      )}
    </div>
  );
}
