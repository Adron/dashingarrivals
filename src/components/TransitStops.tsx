import { useState } from 'react';

interface TransitStop {
  id: string;
  name: string;
  distance: number;
  type: 'bus' | 'train' | 'tram' | 'ferry';
}

interface TransitStopsProps {
  stops: TransitStop[];
  onStopSelect: (stopId: string) => void;
  selectedStops: string[];
  selectedLocation?: { lat: number; lng: number } | null;
}

export default function TransitStops({ stops, onStopSelect, selectedStops, selectedLocation }: TransitStopsProps) {
  return (
    <div className="mt-4 space-y-4">
      {selectedLocation && (
        <div className="p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm mb-4">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Selected Location</h3>
          <p className="text-gray-900 dark:text-white font-mono">
            {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
          </p>
        </div>
      )}
      
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
        Nearby Transit Stops
      </h2>
      
      {!selectedLocation ? (
        <p className="text-gray-600 dark:text-gray-400">
          Click anywhere on the map to find nearby transit stops.
        </p>
      ) : stops.length === 0 ? (
        <p className="text-gray-600 dark:text-gray-400">
          No transit stops found within 1/8 mile of selected location.
        </p>
      ) : (
        <div className="space-y-2">
          {stops.map((stop) => (
            <div
              key={stop.id}
              className={`p-4 rounded-lg border cursor-pointer transition-colors
                ${
                  selectedStops.includes(stop.id)
                    ? 'bg-blue-50 border-blue-500 dark:bg-blue-900/50 dark:border-blue-400'
                    : 'bg-white border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-700'
                }`}
              onClick={() => onStopSelect(stop.id)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    {stop.name}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {Math.round(stop.distance)} meters away
                  </p>
                </div>
                <div className="text-gray-500 dark:text-gray-400">
                  {stop.type.charAt(0).toUpperCase() + stop.type.slice(1)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 