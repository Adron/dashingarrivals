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
    // Longer, sleeker light-rail car (Link LRV): rounded nose, raked windshield,
    // and two window bands down the body.
    body: "M11.6 7 Q11.6 2.6 16 2.6 Q20.4 2.6 20.4 7 L20.4 25 A2.4 2.4 0 0 1 18 27.4 L14 27.4 A2.4 2.4 0 0 1 11.6 25 Z",
    detail:
      "M13 8 Q16 5.5 19 8 L19 10.5 L13 10.5 Z M12.2 14 h7.6 v1.4 h-7.6 z M12.2 18.5 h7.6 v1.4 h-7.6 z",
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
