"use client";

// Invisible client tracker mounted once in the root layout. It reports:
//   • a pageview whenever the route pathname changes (incl. first load), and
//   • a click whenever the visitor activates an interactive element.
//
// Events are sent fire-and-forget via navigator.sendBeacon (fetch+keepalive
// fallback) so they never delay navigation and survive page unload. All of it
// is wrapped so a tracking hiccup can never break the page.

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const ENDPOINT = "/api/analytics/track";

function send(payload: Record<string, unknown>): void {
  try {
    const body = JSON.stringify(payload);
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon(ENDPOINT, blob)) return;
    }
    void fetch(ENDPOINT, {
      method: "POST",
      body,
      keepalive: true,
      headers: { "Content-Type": "application/json" },
    }).catch(() => {});
  } catch {
    // Never throw from tracking.
  }
}

// Interactive elements we consider a meaningful "click".
const INTERACTIVE = 'a, button, [role="button"], [role="link"], [role="tab"], [data-analytics]';

/** Derive a short, stable label for what was clicked. */
function labelFor(el: Element): string {
  const explicit = el.getAttribute("data-analytics");
  if (explicit) return explicit;

  const aria = el.getAttribute("aria-label") || el.getAttribute("title");
  if (aria) return aria.trim();

  const text = (el.textContent || "").replace(/\s+/g, " ").trim();
  if (text) return text;

  const tag = el.tagName.toLowerCase();
  if (tag === "a") {
    const href = el.getAttribute("href");
    if (href) return `link ${href}`;
  }
  return tag;
}

export default function AnalyticsTracker() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  // Pageview on initial load and on every client-side route change.
  useEffect(() => {
    if (!pathname || lastPath.current === pathname) return;
    lastPath.current = pathname;
    send({
      type: "pageview",
      path: pathname,
      referrer: typeof document !== "undefined" ? document.referrer : "",
    });
  }, [pathname]);

  // Global click capture for interactive elements.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      try {
        const start = e.target as Element | null;
        const el = start?.closest?.(INTERACTIVE);
        if (!el) return;

        const payload: Record<string, unknown> = {
          type: "click",
          path: window.location.pathname,
          label: labelFor(el),
        };

        // Record the destination pathname for in-app links (no query string).
        const anchor = el.closest("a") as HTMLAnchorElement | null;
        if (anchor?.href) {
          try {
            payload.href = new URL(anchor.href).pathname;
          } catch {
            // Non-URL href (e.g. mailto:) — leave href off.
          }
        }
        send(payload);
      } catch {
        // Swallow — tracking must be invisible.
      }
    }

    // Capture phase so we still see clicks even if a handler stops propagation.
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}
