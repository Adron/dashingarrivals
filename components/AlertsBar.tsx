"use client";

// Top-center pill showing the active service-alert count; opens a scrollable
// list panel (left side on desktop, bottom sheet on mobile).

import { useState } from "react";
import type { Alert } from "@/lib/types";

export default function AlertsBar({ alerts }: { alerts: Alert[] }) {
  const [open, setOpen] = useState(false);

  if (alerts.length === 0) return null;

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-full bg-amber-500/95 px-3 py-1.5 text-sm font-medium text-amber-950 shadow-lg backdrop-blur hover:bg-amber-400"
        aria-expanded={open}
      >
        ⚠ {alerts.length} service alert{alerts.length === 1 ? "" : "s"}
      </button>

      {open && (
        <aside
          className="absolute inset-x-0 bottom-0 z-30 max-h-[60%] overflow-y-auto rounded-t-2xl bg-white/95 shadow-2xl backdrop-blur sm:inset-y-0 sm:right-auto sm:left-0 sm:w-96 sm:max-h-none sm:rounded-none sm:rounded-r-2xl dark:bg-zinc-900/95 dark:text-zinc-100"
          aria-label="Service alerts"
        >
          <header className="sticky top-0 flex items-center justify-between border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/95">
            <h2 className="text-base font-semibold">Service alerts ({alerts.length})</h2>
            <button
              onClick={() => setOpen(false)}
              className="rounded-full px-2 py-1 text-lg leading-none text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              aria-label="Close"
            >
              ×
            </button>
          </header>

          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {alerts.map((a) => (
              <li key={a.id} className="px-4 py-3">
                <div className="mb-1 flex items-center gap-2">
                  <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                    {a.agency}
                  </span>
                  {a.effect && (
                    <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
                      {a.effect}
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium leading-snug">{a.header}</p>
                {a.description && (
                  <p className="mt-1 line-clamp-3 text-xs text-zinc-500 dark:text-zinc-400">
                    {a.description}
                  </p>
                )}
                {a.url && (
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Details ↗
                  </a>
                )}
              </li>
            ))}
          </ul>
        </aside>
      )}
    </>
  );
}
