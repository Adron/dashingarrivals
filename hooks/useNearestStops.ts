'use client';

import { useState, useEffect } from 'react';
import type { TransitStop, Coordinates } from '@/lib/types';

interface UseNearestStopsReturn {
  stops: TransitStop[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useNearestStops(
  location: Coordinates | null
): UseNearestStopsReturn {
  const [stops, setStops] = useState<TransitStop[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStops = async () => {
    if (!location) {
      setStops([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/stops?lat=${location.lat}&lng=${location.lng}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch stops: ${response.statusText}`);
      }

      const data = await response.json();
      setStops(data.stops || []);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch transit stops';
      setError(errorMessage);
      setStops([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStops();
  }, [location?.lat, location?.lng]);

  return {
    stops,
    isLoading,
    error,
    refetch: fetchStops,
  };
}


