"use client";

import dynamic from "next/dynamic";
import FilterControls from "@/components/FilterControls";
import TopBar from "@/components/TopBar";
import { useVehicleStream } from "@/components/useVehicleStream";

// MapLibre touches `window`, so load the map only on the client.
const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

export default function Home() {
  const { snapshot, error } = useVehicleStream();

  return (
    <main className="relative h-dvh w-screen overflow-hidden">
      <MapView snapshot={snapshot} />
      <TopBar snapshot={snapshot} error={error} />
      <FilterControls />
    </main>
  );
}
