"use client";

// Full-screen MapLibre map that renders live vehicles as a GeoJSON layer.
// Between ~5s snapshots, positions are eased from their previous point to the new
// one on a requestAnimationFrame loop so markers glide instead of jumping.

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { clientConfig } from "@/lib/clientConfig";
import { useFilters, useSelectedStop } from "@/lib/store";
import type { Stop, Vehicle, VehicleSnapshot, VehicleType } from "@/lib/types";

const TYPE_COLORS: Record<VehicleType, string> = {
  bus: "#2563eb",
  train: "#dc2626",
  ferry: "#0891b2",
};

const SOURCE_ID = "vehicles";
const LAYER_ID = "vehicles-circle";

const STOP_SOURCE = "stops";
const STOP_LAYER = "stops-circle";
const STOP_MIN_ZOOM = 14; // only show stops when zoomed in
const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

interface Pos {
  lat: number;
  lon: number;
}

function popupHTML(p: Record<string, unknown>): string {
  const route = String(p.routeShortName || p.routeId || "—");
  const agency = String(p.agencyName || p.agency || "");
  const type = String(p.type || "");
  const updated = p.timestamp ? new Date(Number(p.timestamp)).toLocaleTimeString() : "—";
  return `
    <div style="font: 13px/1.4 system-ui, sans-serif; min-width: 160px;">
      <div style="font-weight:600; font-size:14px;">Route ${route}</div>
      <div style="color:#555; text-transform:capitalize;">${type} · ${agency}</div>
      <div style="color:#888; margin-top:4px;">Updated ${updated}</div>
    </div>`;
}

export default function MapView({ snapshot }: { snapshot: VehicleSnapshot | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const readyRef = useRef(false);
  const rafRef = useRef(0);

  // Tween state (refs so the rAF loop always reads the latest without re-binding).
  const targetsRef = useRef<Map<string, Vehicle>>(new Map());
  const currentRef = useRef<Map<string, Pos>>(new Map());
  const tweenStartRef = useRef(0);
  const settledRef = useRef(false);

  // Filters mirrored into a ref for the render loop; kept in sync via effect.
  const { typeVisible, agencyVisible } = useFilters();
  const filtersRef = useRef({ typeVisible, agencyVisible });
  useEffect(() => {
    filtersRef.current = { typeVisible, agencyVisible };
    settledRef.current = false; // re-render one pass so the filter takes effect
  }, [typeVisible, agencyVisible]);

  // Initialize the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: clientConfig.basemapStyleUrl,
      center: [-122.3321, 47.6062],
      zoom: 10,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __map: maplibregl.Map }).__map = map;
      map.on("error", (e) => console.error("[maplibre]", e?.error?.message ?? e));
    }
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.addControl(new maplibregl.GeolocateControl({ trackUserLocation: false }), "top-right");

    // A flex/dynamic container can settle its size just after the map is created,
    // leaving the map with no initial render (and thus no tiles). Force a resize
    // on the next frame and keep the canvas synced to the container size.
    const container = containerRef.current;
    requestAnimationFrame(() => map.resize());
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(container);

    // The animation loop lives inside the effect (not the render body) and reads
    // only refs, so it always sees the latest state without re-binding.
    const renderFrame = () => {
      if (mapRef.current && readyRef.current && !settledRef.current) {
        const src = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
        if (src) {
          const t = Math.min(1, (performance.now() - tweenStartRef.current) / clientConfig.pollMs);
          const { typeVisible: tv, agencyVisible: av } = filtersRef.current;
          const features: GeoJSON.Feature[] = [];

          for (const [id, target] of targetsRef.current) {
            if (tv[target.type] === false) continue;
            if (av[target.agency] === false) continue;

            const cur = currentRef.current.get(id) ?? { lat: target.lat, lon: target.lon };
            const lat = cur.lat + (target.lat - cur.lat) * t;
            const lon = cur.lon + (target.lon - cur.lon) * t;

            features.push({
              type: "Feature",
              geometry: { type: "Point", coordinates: [lon, lat] },
              properties: {
                id,
                agency: target.agency,
                agencyName: target.agencyName,
                type: target.type,
                routeId: target.routeId ?? "",
                routeShortName: target.routeShortName ?? "",
                bearing: target.bearing ?? 0,
                timestamp: target.timestamp,
              },
            });
          }

          src.setData({ type: "FeatureCollection", features });

          if (t >= 1) {
            // Commit final positions and idle until the next snapshot.
            for (const [id, target] of targetsRef.current) {
              currentRef.current.set(id, { lat: target.lat, lon: target.lon });
            }
            settledRef.current = true;
          }
        }
      }
      rafRef.current = requestAnimationFrame(renderFrame);
    };

    // Load stops for the current viewport (only when zoomed in), debounced.
    let stopsTimer: ReturnType<typeof setTimeout> | undefined;
    const loadStops = async () => {
      const m = mapRef.current;
      const src = m?.getSource(STOP_SOURCE) as maplibregl.GeoJSONSource | undefined;
      if (!m || !src) return;
      if (m.getZoom() < STOP_MIN_ZOOM) {
        src.setData(EMPTY_FC);
        return;
      }
      const b = m.getBounds();
      const lat = (b.getNorth() + b.getSouth()) / 2;
      const lon = (b.getEast() + b.getWest()) / 2;
      const latSpan = b.getNorth() - b.getSouth();
      const lonSpan = b.getEast() - b.getWest();
      try {
        const res = await fetch(
          `/api/stops?lat=${lat}&lon=${lon}&latSpan=${latSpan}&lonSpan=${lonSpan}`,
        );
        if (!res.ok) return;
        const { stops } = (await res.json()) as { stops: Stop[] };
        src.setData({
          type: "FeatureCollection",
          features: (stops ?? []).map((s) => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [s.lon, s.lat] },
            properties: { id: s.id, code: s.code, name: s.name, direction: s.direction ?? "" },
          })),
        });
      } catch {
        // ignore transient errors; the next moveend retries
      }
    };

    map.on("load", () => {
      // Stops layer sits below vehicles so vehicles stay clickable on top.
      map.addSource(STOP_SOURCE, { type: "geojson", data: EMPTY_FC });
      map.addLayer({
        id: STOP_LAYER,
        type: "circle",
        source: STOP_SOURCE,
        minzoom: STOP_MIN_ZOOM,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 14, 3, 18, 6],
          "circle-color": "#ffffff",
          "circle-stroke-color": "#334155",
          "circle-stroke-width": 2,
        },
      });
      map.on("click", STOP_LAYER, (e: maplibregl.MapLayerMouseEvent) => {
        const f = e.features?.[0];
        if (!f || f.geometry.type !== "Point") return;
        const p = f.properties ?? {};
        const [lon, lat] = f.geometry.coordinates as [number, number];
        useSelectedStop.getState().setSelectedStop({
          id: String(p.id),
          code: String(p.code ?? ""),
          name: String(p.name ?? ""),
          lat,
          lon,
          direction: p.direction ? String(p.direction) : undefined,
          routeIds: [],
        });
      });
      map.on("mouseenter", STOP_LAYER, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", STOP_LAYER, () => {
        map.getCanvas().style.cursor = "";
      });

      map.on("moveend", () => {
        clearTimeout(stopsTimer);
        stopsTimer = setTimeout(loadStops, 350);
      });

      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: LAYER_ID,
        type: "circle",
        source: SOURCE_ID,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 3, 12, 5, 16, 8],
          "circle-color": [
            "match",
            ["get", "type"],
            "bus",
            TYPE_COLORS.bus,
            "train",
            TYPE_COLORS.train,
            "ferry",
            TYPE_COLORS.ferry,
            "#666",
          ],
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#ffffff",
          "circle-opacity": 0.95,
        },
      });

      map.on("click", LAYER_ID, (e: maplibregl.MapLayerMouseEvent) => {
        const f = e.features?.[0];
        if (!f || f.geometry.type !== "Point") return;
        new maplibregl.Popup({ closeButton: true, offset: 8 })
          .setLngLat(f.geometry.coordinates as [number, number])
          .setHTML(popupHTML(f.properties ?? {}))
          .addTo(map);
      });
      map.on("mouseenter", LAYER_ID, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", LAYER_ID, () => {
        map.getCanvas().style.cursor = "";
      });

      readyRef.current = true;
      rafRef.current = requestAnimationFrame(renderFrame);
    });

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(stopsTimer);
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
  }, []);

  // New snapshot: set tween targets, seed positions for newly-seen vehicles,
  // and drop ones that vanished.
  useEffect(() => {
    if (!snapshot) return;
    const targets = new Map<string, Vehicle>();
    for (const v of snapshot.vehicles) targets.set(v.id, v);

    for (const [id, v] of targets) {
      if (!currentRef.current.has(id)) {
        currentRef.current.set(id, { lat: v.lat, lon: v.lon });
      }
    }
    for (const id of [...currentRef.current.keys()]) {
      if (!targets.has(id)) currentRef.current.delete(id);
    }

    targetsRef.current = targets;
    tweenStartRef.current = performance.now();
    settledRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot?.updatedAt]);

  return <div ref={containerRef} className="h-full w-full" />;
}
