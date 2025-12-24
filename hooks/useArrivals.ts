'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Arrival } from '@/lib/types';

interface UseArrivalsOptions {
  stopId: string | null;
  limit?: number;
  filterNextHour?: boolean;
  pollInterval?: number; // in milliseconds
}

interface UseArrivalsReturn {
  arrivals: Arrival[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useArrivals({
  stopId,
  limit,
  filterNextHour = false,
  pollInterval = 30000, // 30 seconds default
}: UseArrivalsOptions): UseArrivalsReturn {
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchArrivals = useCallback(async () => {
    if (!stopId) {
      setArrivals([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ stopId });
      if (limit) {
        params.append('limit', limit.toString());
      }
      if (filterNextHour) {
        params.append('filterNextHour', 'true');
      }

      const response = await fetch(`/api/arrivals?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch arrivals: ${response.statusText}`);
      }

      const data = await response.json();
      setArrivals(data.arrivals || []);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch arrivals';
      setError(errorMessage);
      setArrivals([]);
    } finally {
      setIsLoading(false);
    }
  }, [stopId, limit, filterNextHour]);

  useEffect(() => {
    fetchArrivals();

    if (pollInterval > 0 && stopId) {
      const interval = setInterval(fetchArrivals, pollInterval);
      return () => clearInterval(interval);
    }
  }, [fetchArrivals, pollInterval, stopId]);

  return {
    arrivals,
    isLoading,
    error,
    refetch: fetchArrivals,
  };
}


