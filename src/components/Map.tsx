import { useEffect, useRef, useState } from 'react';
import * as maptilersdk from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';

interface MapProps {
  onLocationSelect: (lat: number, lng: number) => void;
}

export default function Map({ onLocationSelect }: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maptilersdk.Map | null>(null);
  const [marker, setMarker] = useState<maptilersdk.Marker | null>(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    // Initialize the map
    maptilersdk.config.apiKey = process.env.NEXT_PUBLIC_MAPTILER_API_KEY || '';
    
    map.current = new maptilersdk.Map({
      container: mapContainer.current,
      style: maptilersdk.MapStyle.STREETS,
      center: [-122.6784, 45.5122], // Default to Portland, OR
      zoom: 13
    });

    // Add click handler
    map.current.on('click', (e) => {
      const { lng, lat } = e.lngLat;
      
      // Remove existing marker if any
      if (marker) {
        marker.remove();
      }

      // Add new marker
      const newMarker = new maptilersdk.Marker()
        .setLngLat([lng, lat])
        .addTo(map.current!);
      
      setMarker(newMarker);
      onLocationSelect(lat, lng);
    });

    return () => {
      map.current?.remove();
    };
  }, []);

  return (
    <div 
      ref={mapContainer} 
      className="w-full h-[60vh] md:h-[70vh] rounded-lg shadow-lg"
    />
  );
} 