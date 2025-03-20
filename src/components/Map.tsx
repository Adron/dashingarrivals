import { useEffect, useRef, useState, useCallback } from 'react';
import * as maptilersdk from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';

interface MapProps {
  onLocationSelect: (lat: number, lng: number) => void;
}

export default function Map({ onLocationSelect }: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maptilersdk.Map | null>(null);
  const [marker, setMarker] = useState<maptilersdk.Marker | null>(null);

  // Initialize map with user location
  useEffect(() => {
    if (!mapContainer.current) return;

    // Initialize the map with default location (will be updated once we get user location)
    maptilersdk.config.apiKey = process.env.NEXT_PUBLIC_MAPTILER_API_KEY || '';
    
    map.current = new maptilersdk.Map({
      container: mapContainer.current,
      style: maptilersdk.MapStyle.STREETS,
      center: [-122.6784, 45.5122], // Default location until we get user's location
      zoom: 13
    });

    // Get user's location
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          
          // Center map on user's location
          map.current?.flyTo({
            center: [longitude, latitude],
            zoom: 14,
            essential: true
          });

          // Add a marker for user's location
          new maptilersdk.Marker({
            color: '#0000FF' // Blue marker for user location
          })
            .setLngLat([longitude, latitude])
            .addTo(map.current!);
        },
        (error) => {
          console.warn('Error getting user location:', error.message);
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        }
      );
    }

    return () => {
      map.current?.remove();
    };
  }, []);

  const handleMapClick = useCallback((e: { lngLat: { lng: number; lat: number } }) => {
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

    // Smoothly fly to the clicked location
    map.current?.flyTo({
      center: [lng, lat],
      zoom: 15, // Slightly zoom in for better view of the area
      essential: true, // This animation is considered essential for the user experience
      duration: 1000 // Animation duration in milliseconds
    });
  }, [marker, onLocationSelect]);

  useEffect(() => {
    if (!map.current) return;
    map.current.on('click', handleMapClick);

    return () => {
      map.current?.off('click', handleMapClick);
    };
  }, [handleMapClick]);

  return (
    <div 
      ref={mapContainer} 
      className="w-full h-[60vh] md:h-[70vh] rounded-lg shadow-lg"
    />
  );
} 