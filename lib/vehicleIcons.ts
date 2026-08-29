// Little vehicle images (bus / train / ferry) for the map. Each is a simple SVG
// silhouette pointing "up" (north); it's rasterized once, tinted with the agency
// color plus a theme-appropriate outline, and registered as a MapLibre image so a
// symbol layer can rotate it to the vehicle's heading.

import { agencyColor } from "@/lib/agencyColors";
import type { VehicleType } from "@/lib/types";

export interface IconPaths {
  /** Main body (filled with the agency color). */
  body: string;
  /** Optional light detail (windshield / deckhouse) that also hints at the front. */
  detail?: string;
}

// All paths are drawn in a 32×32 viewBox, front toward the top (0° = north).
export const VEHICLE_ICON_PATHS: Record<VehicleType, IconPaths> = {
  bus: {
    body: "M12 4 h8 a3 3 0 0 1 3 3 v18 a3 3 0 0 1 -3 3 h-8 a3 3 0 0 1 -3 -3 v-18 a3 3 0 0 1 3 -3 z",
    detail: "M12.5 7.5 h7 a0.5 0.5 0 0 1 0.5 0.5 v2.5 h-8 v-2.5 a0.5 0.5 0 0 1 0.5 -0.5 z",
  },
  train: {
    body: "M11 10 q5 -7 10 0 v14 a2 2 0 0 1 -2 2 h-6 a2 2 0 0 1 -2 -2 z",
    detail: "M12.6 10 q3.4 -4 6.8 0 v2 h-6.8 z",
  },
  ferry: {
    body: "M16 3 l7 9 l-1.5 13 a2 2 0 0 1 -2 2 h-7 a2 2 0 0 1 -2 -2 l-1.5 -13 z",
    detail: "M12.5 13 h7 v7 h-7 z",
  },
};

export type IconTheme = "light" | "dark";

/** Compose the full tinted SVG string for a vehicle type. */
export function vehicleIconSvg(
  type: VehicleType,
  opts: { fill: string; stroke: string; detail?: string },
): string {
  const p = VEHICLE_ICON_PATHS[type];
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">` +
    `<path d="${p.body}" fill="${opts.fill}" stroke="${opts.stroke}" stroke-width="1.75" stroke-linejoin="round"/>` +
    (p.detail ? `<path d="${p.detail}" fill="${opts.detail ?? "#ffffff"}" opacity="0.92"/>` : "") +
    `</svg>`
  );
}

const SIZE = 32;
const SCALE = 2; // retina; addImage should use pixelRatio: SCALE

/** MapLibre pixelRatio to pass to addImage for icons from getVehicleIcon. */
export const ICON_PIXEL_RATIO = SCALE;

async function rasterize(svg: string): Promise<ImageData> {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE * SCALE;
  canvas.height = SIZE * SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");

  const img = new Image();
  img.decoding = "async";
  const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("icon load failed"));
    img.src = url;
  });

  ctx.drawImage(img, 0, 0, SIZE * SCALE, SIZE * SCALE);
  return ctx.getImageData(0, 0, SIZE * SCALE, SIZE * SCALE);
}

// Memoize by agency+type+theme; each entry is generated once.
const cache = new Map<string, Promise<ImageData>>();

export function getVehicleIcon(
  agency: string,
  type: VehicleType,
  theme: IconTheme,
): Promise<ImageData> {
  const key = `${agency}-${type}-${theme}`;
  let p = cache.get(key);
  if (!p) {
    const stroke = theme === "dark" ? "#e5e7eb" : "#0f172a";
    p = rasterize(vehicleIconSvg(type, { fill: agencyColor(agency), stroke }));
    cache.set(key, p);
  }
  return p;
}

export function buildIconId(agency: string, type: VehicleType): string {
  return `veh-${agency}-${type}`;
}

export function parseIconId(id: string): { agency: string; type: VehicleType } | null {
  const m = /^veh-(.+)-(bus|train|ferry)$/.exec(id);
  return m ? { agency: m[1], type: m[2] as VehicleType } : null;
}
