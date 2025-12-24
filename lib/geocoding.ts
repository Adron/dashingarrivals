import type { Coordinates, GeocodingResponse } from './types';

const MAPBOX_GEOCODING_URL = 'https://api.mapbox.com/geocoding/v5/mapbox.places';

/**
 * Geocode an address to coordinates using Mapbox Geocoding API
 */
export async function geocodeAddress(address: string): Promise<Coordinates> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  
  if (!token) {
    throw new Error('NEXT_PUBLIC_MAPBOX_TOKEN is not set');
  }

  const url = new URL(`${MAPBOX_GEOCODING_URL}/${encodeURIComponent(address)}.json`);
  url.searchParams.append('access_token', token);
  url.searchParams.append('limit', '1');
  url.searchParams.append('proximity', '-122.3321,47.6062'); // Seattle center for better results

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`Geocoding API error: ${response.status}`);
  }

  const data: GeocodingResponse = await response.json();

  if (!data.features || data.features.length === 0) {
    throw new Error('No results found for the given address');
  }

  const [lng, lat] = data.features[0].center;

  return { lat, lng };
}

/**
 * Reverse geocode coordinates to an address
 */
export async function reverseGeocode(coordinates: Coordinates): Promise<string> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  
  if (!token) {
    throw new Error('NEXT_PUBLIC_MAPBOX_TOKEN is not set');
  }

  const url = new URL(
    `${MAPBOX_GEOCODING_URL}/${coordinates.lng},${coordinates.lat}.json`
  );
  url.searchParams.append('access_token', token);
  url.searchParams.append('limit', '1');

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`Reverse geocoding API error: ${response.status}`);
  }

  const data: GeocodingResponse = await response.json();

  if (!data.features || data.features.length === 0) {
    return 'Unknown location';
  }

  return data.features[0].place_name;
}


