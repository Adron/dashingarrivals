// Client-side UI state: which vehicle types / agencies are visible on the map.

import { create } from "zustand";
import { ENABLED_AGENCIES } from "@/lib/agencies";
import type { Stop, VehicleType } from "@/lib/types";

// Agencies that can appear on the map (enabled feeds + mock ferries).
export const FILTERABLE_AGENCIES: { code: string; name: string }[] = [
  ...ENABLED_AGENCIES.map((a) => ({ code: a.code, name: a.name })),
  { code: "WSF", name: "Washington State Ferries" },
];

export const VEHICLE_TYPES: VehicleType[] = ["bus", "train", "ferry"];

interface FiltersState {
  typeVisible: Record<VehicleType, boolean>;
  agencyVisible: Record<string, boolean>;
  setType: (type: VehicleType, visible: boolean) => void;
  setAgency: (code: string, visible: boolean) => void;
}

export const useFilters = create<FiltersState>((set) => ({
  typeVisible: { bus: true, train: true, ferry: true },
  agencyVisible: Object.fromEntries(FILTERABLE_AGENCIES.map((a) => [a.code, true])),
  setType: (type, visible) =>
    set((s) => ({ typeVisible: { ...s.typeVisible, [type]: visible } })),
  setAgency: (code, visible) =>
    set((s) => ({ agencyVisible: { ...s.agencyVisible, [code]: visible } })),
}));

interface SelectedStopState {
  selectedStop: Stop | null;
  setSelectedStop: (stop: Stop | null) => void;
}

export const useSelectedStop = create<SelectedStopState>((set) => ({
  selectedStop: null,
  setSelectedStop: (stop) => set({ selectedStop: stop }),
}));

/** A route selected from a vehicle popup, whose shape overlays the map. */
export interface SelectedRoute {
  /** Agency code (e.g. "KCM"). */
  agency: string;
  /** GTFS-RT route id, unprefixed (e.g. "100001"). */
  routeId: string;
  /** Display label (route short name). */
  shortName: string;
  /** Overlay color (agency color). */
  color: string;
}

interface SelectedRouteState {
  selectedRoute: SelectedRoute | null;
  /** True when the route's shape couldn't be loaded (e.g. upstream 429/404). */
  routeError: boolean;
  setSelectedRoute: (route: SelectedRoute | null) => void;
  setRouteError: (error: boolean) => void;
}

export const useSelectedRoute = create<SelectedRouteState>((set) => ({
  selectedRoute: null,
  routeError: false,
  // Selecting (or clearing) a route resets any prior error.
  setSelectedRoute: (route) => set({ selectedRoute: route, routeError: false }),
  setRouteError: (error) => set({ routeError: error }),
}));
