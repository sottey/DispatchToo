"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface KeyboardShortcutsProps {
  onSearchOpen: () => void;
  onShortcutHelp: () => void;
}

export function KeyboardShortcuts({
  onSearchOpen,
  onShortcutHelp,
}: KeyboardShortcutsProps) {
  const router = useRouter();
  const lastKeyRef = useRef<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const tag = target.tagName;

      // Skip when focused on input elements
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }

      // Ctrl+K / Cmd+K — open search (works everywhere)
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        onSearchOpen();
        return;
      }

      // / — open search
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        onSearchOpen();
        return;
      }

      // ? — shortcut help
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        onShortcutHelp();
        return;
      }

      // Escape — close overlays (handled by individual overlays)

      // Sequence-based shortcuts: g+d, g+t, g+n, g+h, n+t, n+n
      const key = e.key.toLowerCase();
      const lastKey = lastKeyRef.current;

      if (lastKey === "g") {
        lastKeyRef.current = null;
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        switch (key) {
          case "d":
            e.preventDefault();
            router.push("/dispatch");
            return;
          case "t":
            e.preventDefault();
            router.push("/tasks");
            return;
          case "n":
            e.preventDefault();
            router.push("/notes");
            return;
          case "h":
            e.preventDefault();
            router.push("/");
            return;
        }
      }

      if (lastKey === "n") {
        lastKeyRef.current = null;
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        switch (key) {
          case "t":
            e.preventDefault();
            window.dispatchEvent(new CustomEvent("shortcut:new-task"));
            return;
          case "n":
            e.preventDefault();
            window.dispatchEvent(new CustomEvent("shortcut:new-note"));
            return;
        }
      }

      // Track key for sequences
      if (key === "g" || key === "n") {
        lastKeyRef.current = key;
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          lastKeyRef.current = null;
        }, 500);
      } else {
        lastKeyRef.current = null;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router, onSearchOpen, onShortcutHelp]);

  return null;
}
