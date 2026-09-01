"use client";

// Full-screen MapLibre map that renders live vehicles as a GeoJSON layer.
// Between ~5s snapshots, positions are eased from their previous point to the new
// one on a requestAnimationFrame loop so markers glide instead of jumping.

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { clientConfig } from "@/lib/clientConfig";
import { AGENCY_COLORS, agencyColor } from "@/lib/agencyColors";
import { resolveBearing } from "@/lib/geo";
import { buildIconId, getVehicleIcon, ICON_PIXEL_RATIO, parseIconId } from "@/lib/vehicleIcons";
import { useFilters, useSelectedRoute, useSelectedStop } from "@/lib/store";
import { trackRouteOpen, trackVehicleClick } from "@/lib/analyticsClient";
import { useTheme } from "@/lib/theme";
import type { Stop, Vehicle, VehicleSnapshot, VehicleType } from "@/lib/types";

const SOURCE_ID = "vehicles";
const LAYER_ID = "vehicles-symbol";
const ICON_TYPES: VehicleType[] = ["bus", "train", "ferry"];

const STOP_SOURCE = "stops";
const STOP_LAYER = "stops-circle";
const STOP_MIN_ZOOM = 14; // only show stops when zoomed in

// Route overlay: the clicked route's shape (line + casing) and its stops.
const ROUTE_SOURCE = "route-shape";
const ROUTE_CASING_LAYER = "route-shape-casing";
const ROUTE_LINE_LAYER = "route-shape-line";
const ROUTE_STOP_SOURCE = "route-stops";
const ROUTE_STOP_LAYER = "route-stops-circle";

const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

interface Pos {
  lat: number;
  lon: number;
}

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
/** Degrees (0 = north, clockwise) → 8-point compass label. */
function compass(deg: number): string {
  return COMPASS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

// Per-type label for the fleet/vehicle number row.
const NUMBER_LABEL: Record<string, string> = { bus: "Bus #", train: "Train #", ferry: "Vessel" };

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
/** Escape feed-sourced strings before interpolating into popup markup. */
function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

function detailRow(label: string, value: string): string {
  return `<div class="va-popup-row"><dt>${label}</dt><dd>${value}</dd></div>`;
}

function popupHTML(p: Record<string, unknown>): string {
  const type = String(p.type || "");
  const route = esc(String(p.routeShortName || p.routeId || "—"));
  const agency = esc(String(p.agencyName || p.agency || ""));
  const agencyCode = String(p.agency || "");
  const color = agencyColor(agencyCode);
  const number = p.vehicleNumber ? esc(String(p.vehicleNumber)) : "";

  // The route is clickable (overlays its shape) only when we have a route id and
  // the agency has OneBusAway route data — i.e. not the WSF ferry feed.
  const routeClickable = !!String(p.routeId || "") && agencyCode !== "WSF";
  const routeTitle = routeClickable
    ? `<button type="button" class="va-popup-route-link">Route ${route}<span class="va-popup-route-cta">Show route ▸</span></button>`
    : `<span>Route ${route}</span>`;

  const bearing = p.bearing == null || p.bearing === "" ? null : Number(p.bearing);
  const heading =
    bearing == null || Number.isNaN(bearing) ? "" : `${compass(bearing)} · ${Math.round(bearing)}°`;

  const speedVal = p.speed == null || p.speed === "" ? null : Number(p.speed);
  const speed =
    speedVal == null || Number.isNaN(speedVal) ? "" : `${Math.round(speedVal * 2.23694)} mph`;

  const updated = p.timestamp ? new Date(Number(p.timestamp)).toLocaleTimeString() : "—";

  const rows: string[] = [];
  if (number) rows.push(detailRow(NUMBER_LABEL[type] ?? "Vehicle", number));
  if (heading) rows.push(detailRow("Heading", heading));
  if (speed) rows.push(detailRow("Speed", speed));

  return `
    <div class="va-popup">
      <div class="va-popup-title">
        <span class="va-popup-dot" style="background:${color}"></span>
        ${routeTitle}
      </div>
      <div class="va-popup-sub">${type ? esc(type) + " · " : ""}${agency}</div>
      ${rows.length ? `<dl class="va-popup-rows">${rows.join("")}</dl>` : ""}
      <div class="va-popup-updated">Updated ${updated}</div>
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

  // Currently-loaded basemap style URL, so the theme effect can skip redundant swaps.
  const currentStyleRef = useRef("");

  // Resolved theme ("light" | "dark") drives which basemap style is shown.
  const resolved = useTheme((s) => s.resolved);

  // Heading per vehicle (feed bearing, or derived from movement) for icon rotation.
  const resolvedBearingRef = useRef<Map<string, number>>(new Map());
  // Current icon theme, read by the styleimagemissing handler when it generates icons.
  const currentThemeRef = useRef<"light" | "dark">(resolved);

  // Current route overlay (line + stops), kept in a ref so installLayers can
  // re-apply it after a basemap/theme swap wipes the sources.
  const routeShapeRef = useRef<{ line: GeoJSON.Feature; stops: GeoJSON.FeatureCollection } | null>(
    null,
  );
  const selectedRoute = useSelectedRoute((s) => s.selectedRoute);

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

    // Match the theme the pre-paint script (app/layout.tsx) already applied, so
    // the map loads in the right style instead of loading light then swapping.
    const initialDark = document.documentElement.classList.contains("dark");
    const initialStyle = initialDark
      ? clientConfig.basemapStyleDark
      : clientConfig.basemapStyleLight;
    currentStyleRef.current = initialStyle;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: initialStyle,
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
                vehicleNumber: target.vehicleNumber ?? "",
                bearing: resolvedBearingRef.current.get(id) ?? target.bearing ?? 0,
                speed: target.speed ?? null,
                icon: buildIconId(target.agency, target.type),
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

    // Open the arrivals panel for a clicked stop feature (viewport or route stop).
    const selectStopFeature = (f: maplibregl.MapGeoJSONFeature) => {
      if (f.geometry.type !== "Point") return;
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
    };

    // Generate + register a vehicle icon on demand. MapLibre asks for a missing
    // icon via "styleimagemissing"; icons are cached by agency+type+theme, so this
    // is cheap and also re-runs after a theme swap (setStyle drops all images).
    const iconInFlight = new Set<string>();
    const addMissingIcon = async (id: string) => {
      if (!id.startsWith("veh-") || map.hasImage(id) || iconInFlight.has(id)) return;
      const parsed = parseIconId(id);
      if (!parsed) return;
      iconInFlight.add(id);
      try {
        const data = await getVehicleIcon(parsed.agency, parsed.type, currentThemeRef.current);
        if (!map.hasImage(id)) map.addImage(id, data, { pixelRatio: ICON_PIXEL_RATIO });
      } catch {
        // ignore; MapLibre re-asks on the next frame that needs it
      } finally {
        iconInFlight.delete(id);
      }
    };
    // Pre-generate the icon set for a theme so the first paint doesn't flash.
    const warmIcons = (theme: "light" | "dark") => {
      for (const code of Object.keys(AGENCY_COLORS)) {
        for (const type of ICON_TYPES) void getVehicleIcon(code, type, theme);
      }
    };
    warmIcons(currentThemeRef.current);

    // (Re)create our sources and layers. Runs on the first style load AND after
    // every runtime style swap (setStyle wipes sources/layers), so it is guarded
    // to be idempotent. Event handlers are bound once in the "load" handler below
    // — they are delegated by layer id and survive a style swap.
    const installLayers = () => {
      // Stops layer sits below vehicles so vehicles stay clickable on top.
      if (!map.getSource(STOP_SOURCE)) {
        map.addSource(STOP_SOURCE, { type: "geojson", data: EMPTY_FC });
      }
      if (!map.getLayer(STOP_LAYER)) {
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
      }

      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
      }
      if (!map.getLayer(LAYER_ID)) {
        map.addLayer({
          id: LAYER_ID,
          type: "symbol",
          source: SOURCE_ID,
          layout: {
            "icon-image": ["get", "icon"], // e.g. "veh-KCM-bus"
            "icon-rotate": ["get", "bearing"], // face direction of travel
            "icon-rotation-alignment": "map",
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
            // Zoom ramp whose per-stop value is per-type (trains larger than
            // buses). The zoom `interpolate` must stay top-level — MapLibre rejects
            // a zoom expression nested inside another (e.g. `*`) — so the per-type
            // `match` is the interpolate's OUTPUT at each stop (base × type factor:
            // train 1.3, ferry 1.15, bus 0.85).
            "icon-size": [
              "interpolate",
              ["linear"],
              ["zoom"],
              8,
              ["match", ["get", "type"], "train", 0.65, "ferry", 0.58, "bus", 0.43, 0.5],
              12,
              ["match", ["get", "type"], "train", 1.04, "ferry", 0.92, "bus", 0.68, 0.8],
              16,
              ["match", ["get", "type"], "train", 1.43, "ferry", 1.27, "bus", 0.94, 1.1],
            ],
          },
        });
      }

      // Route overlay: casing + line + stops, inserted BELOW the viewport-stops
      // layer (and thus below vehicles) so those stay on top and clickable. Order
      // of insertion → stacking: casing, line, route-stops, stops, vehicles.
      const beforeStops = map.getLayer(STOP_LAYER) ? STOP_LAYER : undefined;
      const isDark = currentThemeRef.current === "dark";
      if (!map.getSource(ROUTE_SOURCE)) {
        map.addSource(ROUTE_SOURCE, { type: "geojson", data: EMPTY_FC });
      }
      if (!map.getLayer(ROUTE_CASING_LAYER)) {
        map.addLayer(
          {
            id: ROUTE_CASING_LAYER,
            type: "line",
            source: ROUTE_SOURCE,
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-color": isDark ? "#000000" : "#ffffff",
              "line-opacity": 0.7,
              "line-width": ["interpolate", ["linear"], ["zoom"], 8, 5, 14, 9, 18, 13],
            },
          },
          beforeStops,
        );
      }
      if (!map.getLayer(ROUTE_LINE_LAYER)) {
        map.addLayer(
          {
            id: ROUTE_LINE_LAYER,
            type: "line",
            source: ROUTE_SOURCE,
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-color": ["coalesce", ["get", "color"], "#2563eb"],
              "line-width": ["interpolate", ["linear"], ["zoom"], 8, 2.5, 14, 5, 18, 7],
            },
          },
          beforeStops,
        );
      }
      if (!map.getSource(ROUTE_STOP_SOURCE)) {
        map.addSource(ROUTE_STOP_SOURCE, { type: "geojson", data: EMPTY_FC });
      }
      if (!map.getLayer(ROUTE_STOP_LAYER)) {
        map.addLayer(
          {
            id: ROUTE_STOP_LAYER,
            type: "circle",
            source: ROUTE_STOP_SOURCE,
            paint: {
              "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 2.5, 14, 5, 18, 7],
              "circle-color": isDark ? "#18181b" : "#ffffff",
              "circle-stroke-color": ["coalesce", ["get", "color"], "#2563eb"],
              "circle-stroke-width": 2,
            },
          },
          beforeStops,
        );
      }

      // Re-apply the active route overlay after a style swap wiped the sources.
      if (routeShapeRef.current) {
        (map.getSource(ROUTE_SOURCE) as maplibregl.GeoJSONSource | undefined)?.setData({
          type: "FeatureCollection",
          features: [routeShapeRef.current.line],
        });
        (map.getSource(ROUTE_STOP_SOURCE) as maplibregl.GeoJSONSource | undefined)?.setData(
          routeShapeRef.current.stops,
        );
      }

      // Repaint vehicles from the current tween targets, and (after a swap) refill
      // stops for the current viewport. On the first load, stops load on moveend.
      settledRef.current = false;
      if (readyRef.current) loadStops();
    };

    // Add/refresh our layers on the initial style and after each theme swap.
    map.on("style.load", installLayers);

    map.on("load", () => {
      // Bind interaction handlers once. Delegated by layer id, so they keep
      // working after installLayers re-adds the layers on a style swap.
      map.on("styleimagemissing", (e) => void addMissingIcon(e.id));

      const onStopClick = (e: maplibregl.MapLayerMouseEvent) => {
        const f = e.features?.[0];
        if (f) selectStopFeature(f);
      };
      const setPointer = () => {
        map.getCanvas().style.cursor = "pointer";
      };
      const clearPointer = () => {
        map.getCanvas().style.cursor = "";
      };

      map.on("click", STOP_LAYER, onStopClick);
      map.on("mouseenter", STOP_LAYER, setPointer);
      map.on("mouseleave", STOP_LAYER, clearPointer);

      // Route-overlay stops behave exactly like viewport stops (open arrivals).
      map.on("click", ROUTE_STOP_LAYER, onStopClick);
      map.on("mouseenter", ROUTE_STOP_LAYER, setPointer);
      map.on("mouseleave", ROUTE_STOP_LAYER, clearPointer);

      map.on("moveend", () => {
        clearTimeout(stopsTimer);
        stopsTimer = setTimeout(loadStops, 350);
      });

      map.on("click", LAYER_ID, (e: maplibregl.MapLayerMouseEvent) => {
        const f = e.features?.[0];
        if (!f || f.geometry.type !== "Point") return;
        const props = f.properties ?? {};
        // Analytics: which vehicle (and its route) a visitor clicked on.
        trackVehicleClick({
          agency: props.agency,
          routeId: props.routeId,
          routeShortName: props.routeShortName,
          vehicleNumber: props.vehicleNumber,
        });
        const popup = new maplibregl.Popup({ closeButton: true, offset: 8 })
          .setLngLat(f.geometry.coordinates as [number, number])
          .setHTML(popupHTML(props))
          .addTo(map);
        // Clicking the route title overlays that route's shape + stops.
        const link = popup.getElement()?.querySelector(".va-popup-route-link");
        link?.addEventListener("click", () => {
          // Analytics: which route a visitor chose to view on the map.
          trackRouteOpen({
            agency: props.agency,
            routeId: props.routeId,
            routeShortName: props.routeShortName,
          });
          useSelectedRoute.getState().setSelectedRoute({
            agency: String(props.agency ?? ""),
            routeId: String(props.routeId ?? ""),
            shortName: String(props.routeShortName || props.routeId || ""),
            color: agencyColor(String(props.agency ?? "")),
          });
          popup.remove();
        });
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
    for (const v of snapshot.vehicles) {
      targets.set(v.id, v);
      // Resolve heading using the previous committed position (still in currentRef
      // until the next line seeds new vehicles), so icons can face their direction.
      const prev = currentRef.current.get(v.id);
      resolvedBearingRef.current.set(
        v.id,
        resolveBearing(
          v.bearing,
          prev,
          { lat: v.lat, lon: v.lon },
          resolvedBearingRef.current.get(v.id),
        ),
      );
    }

    for (const [id, v] of targets) {
      if (!currentRef.current.has(id)) {
        currentRef.current.set(id, { lat: v.lat, lon: v.lon });
      }
    }
    for (const id of [...currentRef.current.keys()]) {
      if (!targets.has(id)) {
        currentRef.current.delete(id);
        resolvedBearingRef.current.delete(id);
      }
    }

    targetsRef.current = targets;
    tweenStartRef.current = performance.now();
    settledRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot?.updatedAt]);

  // Swap the basemap style when the resolved theme changes. installLayers (bound
  // to "style.load") re-adds our sources/layers once the new style is ready.
  useEffect(() => {
    currentThemeRef.current = resolved;
    // Warm this theme's icons so the (re)paint after a style swap doesn't flash.
    for (const code of Object.keys(AGENCY_COLORS)) {
      for (const type of ICON_TYPES) void getVehicleIcon(code, type, resolved);
    }

    const map = mapRef.current;
    if (!map) return;
    const nextStyle =
      resolved === "dark" ? clientConfig.basemapStyleDark : clientConfig.basemapStyleLight;
    if (nextStyle === currentStyleRef.current) return;
    currentStyleRef.current = nextStyle;
    map.setStyle(nextStyle, { diff: false });
  }, [resolved]);

  // Fetch + render the selected route's shape and stops, then fit the map to it.
  // Deselecting empties the overlay sources.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!selectedRoute) {
      routeShapeRef.current = null;
      (map.getSource(ROUTE_SOURCE) as maplibregl.GeoJSONSource | undefined)?.setData(EMPTY_FC);
      (map.getSource(ROUTE_STOP_SOURCE) as maplibregl.GeoJSONSource | undefined)?.setData(EMPTY_FC);
      return;
    }

    let cancelled = false;
    const fail = () => {
      if (!cancelled) useSelectedRoute.getState().setRouteError(true);
    };
    (async () => {
      try {
        const res = await fetch(
          `/api/routes/shape?agency=${encodeURIComponent(selectedRoute.agency)}` +
            `&routeId=${encodeURIComponent(selectedRoute.routeId)}`,
        );
        if (cancelled) return;
        if (!res.ok) return fail();
        const shape = (await res.json()) as { path?: GeoJSON.MultiLineString; stops?: Stop[] };
        const m = mapRef.current;
        if (cancelled) return;
        if (!m || !shape.path || shape.path.coordinates.length === 0) return fail();

        const color = selectedRoute.color;
        const line: GeoJSON.Feature = {
          type: "Feature",
          geometry: shape.path,
          properties: { color },
        };
        const stops: GeoJSON.FeatureCollection = {
          type: "FeatureCollection",
          features: (shape.stops ?? []).map((s) => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [s.lon, s.lat] },
            properties: { id: s.id, code: s.code, name: s.name, direction: s.direction ?? "", color },
          })),
        };
        routeShapeRef.current = { line, stops };

        (m.getSource(ROUTE_SOURCE) as maplibregl.GeoJSONSource | undefined)?.setData({
          type: "FeatureCollection",
          features: [line],
        });
        (m.getSource(ROUTE_STOP_SOURCE) as maplibregl.GeoJSONSource | undefined)?.setData(stops);

        const bounds = new maplibregl.LngLatBounds();
        for (const seg of shape.path.coordinates) {
          for (const c of seg) bounds.extend(c as [number, number]);
        }
        if (!bounds.isEmpty()) {
          m.fitBounds(bounds, { padding: 64, maxZoom: 15, duration: 600 });
        }
      } catch {
        fail();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedRoute]);

  return <div ref={containerRef} className="h-full w-full" />;
}
