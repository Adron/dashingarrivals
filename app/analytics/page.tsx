"use client";

// Public analytics dashboard (/analytics). Polls the aggregated stats endpoint
// and renders a lightweight, dependency-free dashboard. Its own visits and
// clicks are tracked by the global AnalyticsTracker mounted in the layout.

import { useEffect, useState } from "react";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { useThemeInit } from "@/lib/theme";
import type { AnalyticsStats, CountItem, DayPoint } from "@/lib/analytics";

const REFRESH_MS = 15_000;

export default function AnalyticsPage() {
  useThemeInit();
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Analytics — Puget Sound Transit";
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      try {
        const res = await fetch("/api/analytics/stats", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as AnalyticsStats;
        if (active) {
          setStats(data);
          setError(null);
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (active) {
          setLoading(false);
          timer = setTimeout(tick, REFRESH_MS);
        }
      }
    };

    tick();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  return (
    <main className="min-h-dvh w-full bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <Header stats={stats} error={error} />

        {loading && !stats ? (
          <p className="mt-16 text-center text-sm text-zinc-500">Loading…</p>
        ) : stats ? (
          <Dashboard stats={stats} />
        ) : (
          <p className="mt-16 text-center text-sm text-red-600 dark:text-red-400">
            Couldn&apos;t load analytics{error ? `: ${error}` : "."}
          </p>
        )}

        <footer className="mt-10 border-t border-zinc-200 pt-4 text-xs text-zinc-400 dark:border-zinc-800">
          First-party analytics · no third-party trackers · anonymous, no PII
          collected.
        </footer>
      </div>
    </main>
  );
}

function Header({
  stats,
  error,
}: {
  stats: AnalyticsStats | null;
  error: string | null;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Site Analytics</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {error ? (
            <span className="text-amber-600 dark:text-amber-400">
              Live data unavailable — retrying…
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Live · updates every 15s
              {stats ? (
                <span className="text-zinc-400">
                  {" · "}
                  {new Date(stats.generatedAt).toLocaleTimeString()}
                  {stats.backend === "memory" ? " · in-memory (ephemeral)" : ""}
                </span>
              ) : null}
            </span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Link
          href="/"
          data-analytics="nav:back-to-map"
          className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <svg
            viewBox="0 0 24 24"
            width="15"
            height="15"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to map
        </Link>
      </div>
    </header>
  );
}

function Dashboard({ stats }: { stats: AnalyticsStats }) {
  const { totals } = stats;
  return (
    <div className="mt-6 space-y-6">
      {stats.backend === "memory" ? <MemoryWarning /> : null}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Pageviews" value={totals.pageviews} />
        <Metric label="Unique visitors" value={totals.uniqueVisitors} />
        <Metric label="Clicks" value={totals.clicks} />
        <Metric label="Total events" value={totals.events} />
      </section>

      <Card title="Traffic — last 14 days">
        <TrafficChart series={stats.series} />
      </Card>

      <SectionLabel>Popular transit</SectionLabel>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Top routes">
          <BarList items={stats.topRoutes} empty="No route clicks yet." />
        </Card>
        <Card title="Top vehicles">
          <BarList items={stats.topVehicles} empty="No vehicle clicks yet." />
        </Card>
      </div>

      <SectionLabel>Where traffic comes from</SectionLabel>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Referrers">
          <BarList items={stats.referrers} empty="No referrers yet." />
        </Card>
        <Card title="Campaign sources (UTM)">
          <BarList items={stats.campaigns} empty="No campaign traffic yet." />
        </Card>
        <Card title="Countries">
          <BarList
            items={stats.countries}
            empty="No country data (production only)."
          />
        </Card>
      </div>

      <SectionLabel>Engagement</SectionLabel>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Top pages">
          <BarList items={stats.topPages} empty="No pageviews yet." />
        </Card>
        <Card title="Most clicked (UI)">
          <BarList items={stats.topClicks} empty="No clicks yet." />
        </Card>
        <Card title="Devices">
          <BarList items={stats.devices} empty="No data yet." />
        </Card>
      </div>

      <Card title="Recent activity">
        <RecentFeed stats={stats} />
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl">
        {value.toLocaleString()}
      </div>
      <div className="mt-0.5 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
        {title}
      </h2>
      {children}
    </section>
  );
}

function MemoryWarning() {
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
      <p className="font-semibold">Numbers may look inconsistent between refreshes.</p>
      <p className="mt-1">
        Analytics is using an <strong>ephemeral in-memory store</strong> because
        no shared Redis is configured. Each serverless instance keeps its own
        counts, so totals and lists can jump around as refreshes land on
        different instances. Configure Upstash Redis (the <code>KV_REST_API_URL</code>
        {" / "}
        <code>KV_REST_API_TOKEN</code> env vars) for consistent, shared, durable
        data.
      </p>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="pt-2 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
      {children}
    </h2>
  );
}

function TrafficChart({ series }: { series: DayPoint[] }) {
  const max = Math.max(1, ...series.map((d) => d.pageviews));
  return (
    <div>
      <div className="flex h-40 items-end gap-1">
        {series.map((d) => {
          const pct = Math.round((d.pageviews / max) * 100);
          return (
            <div
              key={d.day}
              className="group relative flex flex-1 flex-col items-center justify-end"
              title={`${d.day}: ${d.pageviews} views · ${d.visitors} visitors · ${d.clicks} clicks`}
            >
              <div
                className="w-full rounded-t bg-emerald-500/80 transition-all group-hover:bg-emerald-500 dark:bg-emerald-500/70"
                style={{ height: `${Math.max(pct, d.pageviews > 0 ? 4 : 0)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-zinc-400">
        <span>{formatDay(series[0]?.day)}</span>
        <span>{formatDay(series[series.length - 1]?.day)}</span>
      </div>
    </div>
  );
}

function BarList({ items, empty }: { items: CountItem[]; empty: string }) {
  if (!items.length) {
    return <p className="text-sm text-zinc-400">{empty}</p>;
  }
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <ul className="space-y-2">
      {items.map((it) => (
        <li key={it.key}>
          <div className="mb-1 flex items-center justify-between gap-3 text-sm">
            <span className="truncate text-zinc-700 dark:text-zinc-300" title={it.key}>
              {it.key}
            </span>
            <span className="shrink-0 tabular-nums text-zinc-500 dark:text-zinc-400">
              {it.count.toLocaleString()}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div
              className="h-full rounded-full bg-sky-500/80 dark:bg-sky-400/70"
              style={{ width: `${Math.round((it.count / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function RecentFeed({ stats }: { stats: AnalyticsStats }) {
  if (!stats.recent.length) {
    return <p className="text-sm text-zinc-400">No activity yet.</p>;
  }
  return (
    <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
      {stats.recent.map((ev, i) => {
        const b = badge(ev);
        return (
          <li
            key={`${ev.ts}-${i}`}
            className="flex items-center justify-between gap-3 py-2 text-sm"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${b.cls}`}
              >
                {b.text}
              </span>
              <span className="truncate text-zinc-700 dark:text-zinc-300">
                {ev.type === "click" ? ev.label : ev.path}
                {ev.type === "click" && ev.href ? (
                  <span className="text-zinc-400"> → {ev.href}</span>
                ) : null}
              </span>
            </span>
            <span
              className="shrink-0 text-xs text-zinc-400"
              title={new Date(ev.ts).toLocaleString()}
            >
              {timeAgo(ev.ts, stats.generatedAt)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Category-aware badge (text + color) for a recent event. */
function badge(ev: AnalyticsStats["recent"][number]): { text: string; cls: string } {
  if (ev.type === "pageview")
    return {
      text: "view",
      cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    };
  if (ev.category === "vehicle")
    return {
      text: "vehicle",
      cls: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    };
  if (ev.category === "route")
    return {
      text: "route",
      cls: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
    };
  return {
    text: "click",
    cls: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  };
}

function formatDay(day?: string): string {
  if (!day) return "";
  const [, m, d] = day.split("-");
  return `${Number(m)}/${Number(d)}`;
}

function timeAgo(ts: number, now: number): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
