'use client';

import { useState } from 'react';
import Map from '@/components/Map';
import TransitStops from '@/components/TransitStops';
import Arrivals from '@/components/Arrivals';

// Mock data for development - replace with actual API calls
const mockStops = [
  { id: '1', name: 'Downtown Station', distance: 120, type: 'train' as const },
  { id: '2', name: 'Main St & 5th', distance: 180, type: 'bus' as const },
  { id: '3', name: 'Waterfront Terminal', distance: 200, type: 'ferry' as const },
];

const mockArrivals = [
  {
    id: '1',
    routeName: 'Blue Line',
    destination: 'Airport',
    expectedArrival: new Date(Date.now() + 5 * 60000),
    delay: 0,
    type: 'train' as const,
  },
  {
    id: '2',
    routeName: 'Route 15',
    destination: 'Downtown',
    expectedArrival: new Date(Date.now() + 12 * 60000),
    delay: 5,
    type: 'bus' as const,
  },
];

export default function Home() {
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedStops, setSelectedStops] = useState<string[]>([]);
  const [stops, setStops] = useState<typeof mockStops>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleLocationSelect = async (lat: number, lng: number) => {
    setIsLoading(true);
    setSelectedLocation({ lat, lng });
    setSelectedStops([]); // Clear selected stops when new location is picked
    
    // These coordinates will be used when implementing the actual API call
    // to fetch nearby transit stops within 1/8th mile radius
    console.log(`Searching for stops near ${lat}, ${lng}`);
    
    // Simulate API call delay
    setTimeout(() => {
      // In the real implementation, you would:
      // 1. Calculate the 1/8 mile radius (about 201 meters)
      // 2. Query your transit API for stops within that radius
      // 3. Calculate actual distances to each stop
      setStops(mockStops);
      setIsLoading(false);
    }, 1000);
  };

  const handleStopSelect = (stopId: string) => {
    setSelectedStops((prev) => {
      if (prev.includes(stopId)) {
        return prev.filter((id) => id !== stopId);
      }
      return [...prev, stopId];
    });
  };

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
          Dashing Arrivals
        </h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Map onLocationSelect={handleLocationSelect} />
          </div>
          
          <div className="space-y-6">
            <TransitStops
              stops={stops}
              onStopSelect={handleStopSelect}
              selectedStops={selectedStops}
              selectedLocation={selectedLocation}
            />
            
            {selectedStops.map((stopId) => (
              <Arrivals
                key={stopId}
                stopId={stopId}
                arrivals={mockArrivals}
                isLoading={isLoading}
              />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
