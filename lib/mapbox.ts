import type { Coordinates } from './types';

export function initializeMapbox() {
  if (typeof window !== 'undefined' && !process.env.NEXT_PUBLIC_MAPBOX_TOKEN) {
    console.warn('Mapbox token not found. Please set NEXT_PUBLIC_MAPBOX_TOKEN');
  }
}

export function getMapboxToken(): string {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) {
    throw new Error('NEXT_PUBLIC_MAPBOX_TOKEN is not set');
  }
  return token;
}

export function formatCoordinates(coords: Coordinates): [number, number] {
  return [coords.lng, coords.lat];
}


