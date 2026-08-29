"use client";

// Floating panel to toggle vehicle types and agencies on the map, doubling as the
// legend: color = agency, shape = vehicle type.

import { agencyColor } from "@/lib/agencyColors";
import { FILTERABLE_AGENCIES, useFilters, VEHICLE_TYPES } from "@/lib/store";
import { VEHICLE_ICON_PATHS } from "@/lib/vehicleIcons";
import type { VehicleType } from "@/lib/types";

const TYPE_LABELS: Record<VehicleType, string> = {
  bus: "Buses",
  train: "Trains",
  ferry: "Ferries",
};

function TypeGlyph({ type }: { type: VehicleType }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className="h-4 w-4 shrink-0 text-zinc-700 dark:text-zinc-200"
      aria-hidden
    >
      <path d={VEHICLE_ICON_PATHS[type].body} fill="currentColor" />
    </svg>
  );
}

export default function FilterControls() {
  const { typeVisible, agencyVisible, setType, setAgency } = useFilters();

  return (
    <div className="absolute bottom-4 left-4 z-10 w-52 rounded-xl bg-white/90 p-3 text-sm shadow-lg backdrop-blur dark:bg-zinc-900/90 dark:text-zinc-100">
      <div className="mb-2 font-semibold">Show</div>

      <div className="space-y-1.5">
        {VEHICLE_TYPES.map((t) => (
          <label key={t} className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={typeVisible[t]}
              onChange={(e) => setType(t, e.target.checked)}
              className="accent-blue-600"
            />
            <TypeGlyph type={t} />
            {TYPE_LABELS[t]}
          </label>
        ))}
      </div>

      <div className="mt-3 mb-1 border-t border-zinc-200 pt-2 font-semibold dark:border-zinc-700">
        Agencies
      </div>
      <div className="space-y-1.5">
        {FILTERABLE_AGENCIES.map((a) => (
          <label key={a.code} className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={agencyVisible[a.code] ?? true}
              onChange={(e) => setAgency(a.code, e.target.checked)}
              className="accent-blue-600"
            />
            <span
              className="inline-block h-3 w-3 shrink-0 rounded-sm border border-black/10 dark:border-white/20"
              style={{ backgroundColor: agencyColor(a.code) }}
            />
            <span className="truncate" title={a.name}>
              {a.name}
            </span>
          </label>
        ))}
      </div>

      <p className="mt-2 border-t border-zinc-200 pt-2 text-[11px] leading-snug text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
        Color = agency · shape = type · icons face travel direction
      </p>
    </div>
  );
}
