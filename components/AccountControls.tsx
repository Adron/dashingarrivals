"use client";

// TopBar controls for accounts: the "Saved" menu and the Sign in / account
// button. Signed in, Saved lists the account's own Top 5 Routes and stops;
// signed out, it shows the "Most Popular Top 5" across all accounts.
// Hidden entirely unless NEXT_PUBLIC_ACCOUNTS_ENABLED is "true".

import { useEffect, useRef, useState, type ReactNode } from "react";
import SignInDialog from "@/components/SignInDialog";
import { useAccount } from "@/lib/account";
import { MAX_FAVORITE_ROUTES, type FavoriteRoute, type FavoriteStop } from "@/lib/accountSettings";
import { clientConfig } from "@/lib/clientConfig";
import { useMapFocus, useSelectedRoute, useSelectedStop } from "@/lib/store";

const button =
  "inline-flex items-center gap-1 rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800";

export default function AccountControls() {
  if (!clientConfig.accountsEnabled) return null;
  return (
    <div className="flex items-center gap-2">
      <SavedMenu />
      <AccountButton />
    </div>
  );
}

/** A button with a dropdown panel that closes on outside click or Escape. */
function Popover({
  label,
  title,
  analytics,
  children,
}: {
  label: ReactNode;
  title: string;
  analytics: string;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title={title}
        data-analytics={analytics}
        className={button}
      >
        {label}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-64 rounded-xl bg-white p-2 text-zinc-900 shadow-xl ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-700">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

function SavedMenu() {
  const routes = useAccount((s) => s.favoriteRoutes);
  const stops = useAccount((s) => s.favoriteStops);
  const popular = useAccount((s) => s.popularRoutes);
  const synced = useAccount((s) => s.synced);
  const status = useAccount((s) => s.status);
  const settingsError = useAccount((s) => s.settingsError);
  const saveError = useAccount((s) => s.saveError);
  const { toggleRoute, toggleStop } = useAccount.getState();
  const signedIn = status === "signedIn";

  const openRoute = (r: FavoriteRoute) => useSelectedRoute.getState().setSelectedRoute(r);
  const openStop = (stop: FavoriteStop) => {
    useSelectedStop.getState().setSelectedStop({ ...stop, routeIds: [] });
    useMapFocus.getState().focusOn({ lat: stop.lat, lon: stop.lon, zoom: 16 });
  };

  return (
    <Popover
      title={signedIn ? "Your Top 5 Routes and saved stops" : "Most popular saved routes"}
      analytics="nav:saved"
      label={
        <>
          <span aria-hidden="true">★</span> Saved
        </>
      }
    >
      {(close) =>
        !signedIn ? (
          <div className="text-sm">
            <Section title={`Most Popular Top ${MAX_FAVORITE_ROUTES}`}>
              {popular.length === 0 ? (
                <Empty>No routes saved yet. Be the first!</Empty>
              ) : (
                popular.map((r) => (
                  <Row
                    key={`${r.agency}:${r.routeId}`}
                    onOpen={() => {
                      openRoute(r);
                      close();
                    }}
                  >
                    <RouteLabel route={r} />
                    <span className="ml-auto shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                      {r.count} {r.count === 1 ? "save" : "saves"}
                    </span>
                  </Row>
                ))
              )}
            </Section>
            <p className="border-t border-zinc-100 px-2 pt-2 text-[11px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              The routes most often saved to accounts&apos; Top {MAX_FAVORITE_ROUTES}. Sign in to save
              your own routes and stops.
            </p>
          </div>
        ) : (
          <div className="text-sm">
            <Section title={`Top ${MAX_FAVORITE_ROUTES} Routes`}>
              {routes.length === 0 ? (
                <Empty>Open a route from a vehicle, then tap ☆ to add it.</Empty>
              ) : (
                routes.map((r) => (
                  <Row
                    key={`${r.agency}:${r.routeId}`}
                    onOpen={() => {
                      openRoute(r);
                      close();
                    }}
                    onRemove={() => toggleRoute(r)}
                    removeLabel={`Remove route ${r.shortName}`}
                  >
                    <RouteLabel route={r} />
                  </Row>
                ))
              )}
            </Section>

            <Section title="Stops">
              {stops.length === 0 ? (
                <Empty>Open a stop&apos;s arrivals, then tap ☆ to save it.</Empty>
              ) : (
                stops.map((s) => (
                  <Row
                    key={s.id}
                    onOpen={() => {
                      openStop(s);
                      close();
                    }}
                    onRemove={() => toggleStop(s)}
                    removeLabel={`Remove stop ${s.name}`}
                  >
                    <span className="truncate">{s.name}</span>
                    {s.code && (
                      <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">#{s.code}</span>
                    )}
                  </Row>
                ))
              )}
            </Section>

            {saveError && (
              <p className="px-2 pt-1 text-xs text-amber-700 dark:text-amber-400">{saveError}</p>
            )}
            <p className="border-t border-zinc-100 px-2 pt-2 text-[11px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              {synced ? "Saved to your account." : (settingsError ?? "Saved settings are unavailable.")}
            </p>
          </div>
        )
      }
    </Popover>
  );
}

function RouteLabel({ route }: { route: FavoriteRoute }) {
  return (
    <>
      <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: route.color }} />
      <span className="font-semibold">{route.shortName}</span>
      <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">{route.agency}</span>
    </>
  );
}

function AccountButton() {
  const status = useAccount((s) => s.status);
  const user = useAccount((s) => s.user);
  const settingsError = useAccount((s) => s.settingsError);
  const [dialogOpen, setDialogOpen] = useState(false);

  if (status !== "signedIn" || !user) {
    return (
      <>
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          disabled={status === "loading" || status === "idle"}
          data-analytics="nav:sign-in"
          className={`${button} disabled:opacity-60`}
        >
          <PersonIcon />
          Sign in
        </button>
        {dialogOpen && <SignInDialog onClose={() => setDialogOpen(false)} />}
      </>
    );
  }

  const name = user.displayName || user.email;
  return (
    <Popover
      title={`Signed in as ${user.email}`}
      analytics="nav:account"
      label={
        <>
          <PersonIcon />
          <span className="max-w-28 truncate">{name}</span>
        </>
      }
    >
      {(close) => (
        <div className="space-y-2 p-1 text-sm">
          <div>
            {user.displayName && <p className="font-medium">{user.displayName}</p>}
            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{user.email}</p>
          </div>
          {!user.emailVerified && (
            <p className="text-xs text-zinc-600 dark:text-zinc-300">
              Check your inbox to verify your email address.
            </p>
          )}
          {settingsError && (
            <p className="text-xs text-amber-700 dark:text-amber-400">{settingsError}</p>
          )}
          <button
            type="button"
            onClick={() => {
              close();
              void useAccount.getState().signOut();
            }}
            data-analytics="nav:sign-out"
            className="w-full rounded-md px-2 py-1.5 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Sign out
          </button>
        </div>
      )}
    </Popover>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-2">
      <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {title}
      </p>
      <ul>{children}</ul>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <li className="px-2 py-1 text-xs text-zinc-500 dark:text-zinc-400">{children}</li>;
}

function Row({
  children,
  onOpen,
  onRemove,
  removeLabel,
}: {
  children: ReactNode;
  onOpen: () => void;
  /** Omitted for read-only rows (the Most Popular list). */
  onRemove?: () => void;
  removeLabel?: string;
}) {
  return (
    <li className="flex items-center gap-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left"
      >
        {children}
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          title="Remove"
          className="shrink-0 rounded px-2 py-1 text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100"
        >
          ×
        </button>
      )}
    </li>
  );
}

function PersonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}
