'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import StopDetail from '@/components/StopDetail';
import { useArrivals } from '@/hooks/useArrivals';
import type { TransitStop } from '@/lib/types';

export default function StopDetailPage() {
  const params = useParams();
  const stopId = params.stopId as string;
  const [stop, setStop] = useState<TransitStop | null>(null);

  const {
    arrivals,
    isLoading,
    error,
  } = useArrivals({
    stopId,
    filterNextHour: true,
    pollInterval: 30000, // 30 seconds
  });

  // Fetch stop details
  useEffect(() => {
    if (!stopId) return;

    // We need to get stop details - we'll fetch from stops API
    // For now, we'll create a minimal stop object
    // In a real app, you might want a dedicated stop details endpoint
    const fetchStopDetails = async () => {
      try {
        // Try to get stop info from a stops search near a default location
        // This is a workaround - ideally we'd have a stop-by-id endpoint
        const response = await fetch(
          `/api/stops?lat=47.6062&lng=-122.3321`
        );
        const data = await response.json();
        const foundStop = data.stops?.find(
          (s: TransitStop) => s.id === stopId
        );
        if (foundStop) {
          setStop(foundStop);
        } else {
          // Create a minimal stop object if not found
          setStop({
            id: stopId,
            name: `Stop ${stopId}`,
            coordinates: { lat: 0, lng: 0 },
          });
        }
      } catch (err) {
        // Create a minimal stop object on error
        setStop({
          id: stopId,
          name: `Stop ${stopId}`,
          coordinates: { lat: 0, lng: 0 },
        });
      }
    };

    fetchStopDetails();
  }, [stopId]);

  if (!stop) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <svg
            className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <p className="text-gray-600">Loading stop details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
            <p className="font-semibold mb-2">Error loading stop</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return <StopDetail stop={stop} arrivals={arrivals} isLoading={isLoading} />;
}


