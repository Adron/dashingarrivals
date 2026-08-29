"use client";

import dynamic from "next/dynamic";
import AlertsBar from "@/components/AlertsBar";
import ArrivalsPanel from "@/components/ArrivalsPanel";
import FilterControls from "@/components/FilterControls";
import RouteOverlayBar from "@/components/RouteOverlayBar";
import TopBar from "@/components/TopBar";
import { useAlerts } from "@/components/useAlerts";
import { useVehicleStream } from "@/components/useVehicleStream";
import { useThemeInit } from "@/lib/theme";

// MapLibre touches `window`, so load the map only on the client.
const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

export default function Home() {
  useThemeInit();
  const { snapshot, error } = useVehicleStream();
  const alerts = useAlerts();

  return (
    <main className="relative h-dvh w-screen overflow-hidden">
      <MapView snapshot={snapshot} />
      <TopBar snapshot={snapshot} error={error} />
      <AlertsBar alerts={alerts} />
      <RouteOverlayBar />
      <FilterControls />
      <ArrivalsPanel alerts={alerts} />
    </main>
  );
}
