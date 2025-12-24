'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Map from '@/components/Map';
import LocationButton from '@/components/LocationButton';
import AddressInput from '@/components/AddressInput';
import ArrivalList from '@/components/ArrivalList';
import { useNearestStops } from '@/hooks/useNearestStops';
import { useArrivals } from '@/hooks/useArrivals';
import type { Coordinates, TransitStop } from '@/lib/types';

// Default to Seattle center if no location is available
const DEFAULT_LOCATION: Coordinates = {
  lat: 47.6062,
  lng: -122.3321,
};

export default function Home() {
  const router = useRouter();
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [showAddressInput, setShowAddressInput] = useState(false);

  const { stops, isLoading: stopsLoading, error: stopsError } =
    useNearestStops(location);

  const {
    arrivals,
    isLoading: arrivalsLoading,
    error: arrivalsError,
  } = useArrivals({
    stopId: selectedStopId,
    limit: 3,
    pollInterval: 30000, // 30 seconds
  });

  // Initialize with default location or try to get GPS
  useEffect(() => {
    if (!location) {
      setLocation(DEFAULT_LOCATION);
    }
  }, [location]);

  const handleLocationFound = (coordinates: Coordinates) => {
    setLocation(coordinates);
    setShowAddressInput(false);
  };

  const handleAddressSelected = (coordinates: Coordinates) => {
    setLocation(coordinates);
    setShowAddressInput(false);
  };

  const handleStopClick = (stop: TransitStop) => {
    setSelectedStopId(stop.id);
  };

  const handleStopDoubleClick = (stop: TransitStop) => {
    router.push(`/stop/${stop.id}`);
  };

  const currentLocation = location || DEFAULT_LOCATION;

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="bg-white shadow-sm border-b px-4 py-3">
        <h1 className="text-2xl font-bold text-gray-900">
          Dashing Arrivals
        </h1>
        <p className="text-sm text-gray-600">
          Find your nearest transit stops
        </p>
      </header>

      {/* Map Container */}
      <div className="flex-1 relative">
        <Map
          center={currentLocation}
          stops={stops}
          selectedStopId={selectedStopId || undefined}
          onStopClick={handleStopClick}
          onStopDoubleClick={handleStopDoubleClick}
        />

        {/* Loading overlay */}
        {stopsLoading && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white px-4 py-2 rounded-lg shadow-lg">
            <div className="flex items-center gap-2">
              <svg
                className="animate-spin h-5 w-5 text-blue-600"
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
              <span className="text-sm text-gray-700">Finding stops...</span>
            </div>
          </div>
        )}

        {/* Error message */}
        {stopsError && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-50 border border-red-200 text-red-800 px-4 py-2 rounded-lg shadow-lg max-w-md">
            <p className="text-sm">{stopsError}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 text-sm underline"
            >
              Retry
            </button>
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="bg-white border-t shadow-lg px-4 py-4">
        {showAddressInput ? (
          <div className="space-y-3">
            <AddressInput onAddressSelected={handleAddressSelected} />
            <button
              onClick={() => setShowAddressInput(false)}
              className="w-full px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex gap-3">
            <LocationButton
              onLocationFound={handleLocationFound}
              className="flex-1"
            />
            <button
              onClick={() => setShowAddressInput(true)}
              className="px-4 py-2 rounded-lg font-medium bg-gray-200 text-gray-800 hover:bg-gray-300 transition-colors"
            >
              <span className="flex items-center gap-2">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                Address
              </span>
            </button>
          </div>
        )}

        {/* Arrivals List */}
        {selectedStopId && (
          <div className="mt-4">
            <ArrivalList
              arrivals={arrivals}
              isLoading={arrivalsLoading}
            />
            {arrivalsError && (
              <div className="mt-2 p-2 bg-red-50 border border-red-200 text-red-800 rounded text-sm">
                {arrivalsError}
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        {!selectedStopId && stops.length > 0 && (
          <p className="mt-4 text-xs text-gray-500 text-center">
            Tap a stop to see arrivals • Double-tap to view details
          </p>
        )}
      </div>
    </div>
  );
}


