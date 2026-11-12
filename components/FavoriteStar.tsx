"use client";

// ☆/★ toggle for saving a route (Top 5) or a stop. Renders nothing unless
// accounts are enabled, and is disabled unless an account is signed in with
// its settings loaded (favorites are only ever saved to an account).

import { useAccount } from "@/lib/account";
import { clientConfig } from "@/lib/clientConfig";

export default function FavoriteStar({
  active,
  disabled = false,
  onToggle,
  label,
  disabledTitle,
}: {
  active: boolean;
  disabled?: boolean;
  onToggle: () => void;
  /** What's being saved, e.g. "route 8" — used in the button's label. */
  label: string;
  /** Tooltip when disabled (e.g. "Top 5 is full"). */
  disabledTitle?: string;
}) {
  const synced = useAccount((s) => s.synced);
  const signedIn = useAccount((s) => s.status === "signedIn");
  if (!clientConfig.accountsEnabled) return null;
  const blocked = !synced || disabled;
  const blockedTitle = synced
    ? disabledTitle
    : signedIn
      ? "Saving is unavailable for this account right now"
      : `Sign in to save ${label}`;
  const title = blocked ? blockedTitle : active ? `Remove ${label} from saved` : `Save ${label}`;
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={blocked}
      aria-pressed={active}
      aria-label={title}
      title={title}
      className={`shrink-0 rounded-full px-1.5 py-0.5 text-lg leading-none transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "text-amber-500 hover:text-amber-600"
          : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-100"
      }`}
    >
      {active ? "★" : "☆"}
    </button>
  );
}
