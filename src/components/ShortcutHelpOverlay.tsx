"use client";

import { useEffect } from "react";

interface ShortcutHelpOverlayProps {
  onClose: () => void;
}

const SHORTCUTS = [
  { keys: ["Ctrl", "K"], description: "Open search" },
  { keys: ["/"], description: "Open search" },
  { keys: ["g", "h"], description: "Go to Dashboard" },
  { keys: ["g", "d"], description: "Go to Dispatch" },
  { keys: ["g", "t"], description: "Go to Tasks" },
  { keys: ["g", "n"], description: "Go to Notes" },
  { keys: ["n", "t"], description: "New task" },
  { keys: ["n", "n"], description: "New note" },
  { keys: ["?"], description: "Show shortcuts" },
  { keys: ["Esc"], description: "Close overlay" },
];

export function ShortcutHelpOverlay({ onClose }: ShortcutHelpOverlayProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl bg-white dark:bg-gray-800 p-6 shadow-2xl mx-4">
        <h2 className="text-lg font-semibold dark:text-white mb-4">
          Keyboard Shortcuts
        </h2>
        <div className="space-y-2">
          {SHORTCUTS.map((shortcut, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-1.5"
            >
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {shortcut.description}
              </span>
              <div className="flex items-center gap-1">
                {shortcut.keys.map((key, j) => (
                  <span key={j}>
                    {j > 0 && (
                      <span className="text-xs text-gray-400 dark:text-gray-500 mx-0.5">
                        then
                      </span>
                    )}
                    <kbd className="inline-block min-w-[24px] text-center text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-1.5 py-0.5">
                      {key}
                    </kbd>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
