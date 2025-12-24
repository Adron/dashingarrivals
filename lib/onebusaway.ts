import type {
  TransitStop,
  Coordinates,
  OneBusAwayStopResponse,
  OneBusAwayArrivalResponse,
  Arrival,
} from './types';

const ONEBUSAWAY_BASE_URL =
  process.env.ONEBUSAWAY_BASE_URL || 'https://api.pugetsound.onebusaway.org';
const ONEBUSAWAY_API_KEY = process.env.ONEBUSAWAY_API_KEY;

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function calculateDistance(
  coord1: Coordinates,
  coord2: Coordinates
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (coord1.lat * Math.PI) / 180;
  const φ2 = (coord2.lat * Math.PI) / 180;
  const Δφ = ((coord2.lat - coord1.lat) * Math.PI) / 180;
  const Δλ = ((coord2.lng - coord1.lng) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Find nearest transit stops to a location
 */
export async function findNearestStops(
  location: Coordinates,
  limit: number = 3
): Promise<TransitStop[]> {
  try {
    const url = new URL(`${ONEBUSAWAY_BASE_URL}/api/where/stops-for-location.json`);
    url.searchParams.append('lat', location.lat.toString());
    url.searchParams.append('lon', location.lng.toString());
    url.searchParams.append('radius', '500'); // 500 meter radius
    url.searchParams.append('maxCount', '50'); // Get more to filter by distance
    
    if (ONEBUSAWAY_API_KEY) {
      url.searchParams.append('key', ONEBUSAWAY_API_KEY);
    }

    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`OneBusAway API error: ${response.status}`);
    }

    const data: OneBusAwayStopResponse = await response.json();

    if (data.code !== 200) {
      throw new Error(`OneBusAway API returned error code: ${data.code}`);
    }

    // Convert to TransitStop format and calculate distances
    const stops: TransitStop[] = data.data.list.map((stop) => ({
      id: stop.id,
      name: stop.name,
      code: stop.code,
      coordinates: {
        lat: stop.lat,
        lng: stop.lon,
      },
      direction: stop.direction,
      distance: calculateDistance(location, {
        lat: stop.lat,
        lng: stop.lon,
      }),
    }));

    // Sort by distance and return top N
    return stops
      .sort((a, b) => (a.distance || 0) - (b.distance || 0))
      .slice(0, limit);
  } catch (error) {
    console.error('Error fetching stops from OneBusAway:', error);
    // Fallback: Return empty array (GTFS fallback could be implemented here)
    throw error;
  }
}

/**
 * Get arrivals for a specific stop
 */
export async function getStopArrivals(
  stopId: string,
  currentTime?: number
): Promise<Arrival[]> {
  try {
    const url = new URL(`${ONEBUSAWAY_BASE_URL}/api/where/arrivals-and-departures-for-stop/${stopId}.json`);
    
    if (ONEBUSAWAY_API_KEY) {
      url.searchParams.append('key', ONEBUSAWAY_API_KEY);
    }

    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`OneBusAway API error: ${response.status}`);
    }

    const data: OneBusAwayArrivalResponse = await response.json();

    if (data.code !== 200) {
      throw new Error(`OneBusAway API returned error code: ${data.code}`);
    }

    const serverTime = data.currentTime || Date.now();
    const now = currentTime || Date.now();

    // Convert to Arrival format
    const arrivals: Arrival[] = data.data.entry.arrivalsAndDepartures
      .filter((item) => item.arrivalEnabled) // Only show arrivals
      .map((item) => {
        const predictedTime = item.predictedArrivalTime
          ? item.predictedArrivalTime
          : null;
        const scheduledTime = item.scheduledArrivalTime;
        const arrivalTime = predictedTime || scheduledTime;
        const minutesUntilArrival = Math.max(
          0,
          Math.floor((arrivalTime - now) / 60000)
        );

        return {
          routeId: item.routeId,
          routeShortName: item.routeShortName,
          routeLongName: item.routeLongName,
          tripHeadsign: item.tripHeadsign,
          predictedArrivalTime: predictedTime || undefined,
          scheduledArrivalTime: scheduledTime,
          minutesUntilArrival,
          status: predictedTime ? 'predicted' : 'scheduled',
        };
      })
      .filter((arrival) => arrival.minutesUntilArrival !== undefined)
      .sort((a, b) => (a.minutesUntilArrival || 0) - (b.minutesUntilArrival || 0));

    return arrivals;
  } catch (error) {
    console.error('Error fetching arrivals from OneBusAway:', error);
    throw error;
  }
}

/**
 * Filter arrivals to show only those in the next hour
 */
export function filterArrivalsNextHour(arrivals: Arrival[]): Arrival[] {
  const oneHourFromNow = Date.now() + 60 * 60 * 1000;
  
  return arrivals.filter((arrival) => {
    const arrivalTime =
      arrival.predictedArrivalTime || arrival.scheduledArrivalTime;
    return arrivalTime <= oneHourFromNow;
  });
}


