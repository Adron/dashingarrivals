'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { getMapboxToken, formatCoordinates } from '@/lib/mapbox';
import type { TransitStop, Coordinates } from '@/lib/types';

interface MapProps {
  center: Coordinates;
  stops: TransitStop[];
  selectedStopId?: string;
  onStopClick: (stop: TransitStop) => void;
  onStopDoubleClick: (stop: TransitStop) => void;
}

export default function Map({
  center,
  stops,
  selectedStopId,
  onStopClick,
  onStopDoubleClick,
}: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    try {
      mapboxgl.accessToken = getMapboxToken();

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: formatCoordinates(center),
        zoom: 15,
      });

      map.current.on('load', () => {
        setIsMapLoaded(true);
      });

      // Add user location marker
      new mapboxgl.Marker({ color: '#3b82f6' })
        .setLngLat(formatCoordinates(center))
        .setPopup(new mapboxgl.Popup().setText('Your location'))
        .addTo(map.current);
    } catch (error) {
      console.error('Error initializing map:', error);
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Update map center when location changes
  useEffect(() => {
    if (map.current && isMapLoaded) {
      map.current.flyTo({
        center: formatCoordinates(center),
        zoom: 15,
      });
    }
  }, [center, isMapLoaded]);

  // Update markers when stops change
  useEffect(() => {
    if (!map.current || !isMapLoaded) return;

    // Remove existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();

    // Add new markers for each stop
    stops.forEach((stop) => {
      const el = document.createElement('div');
      el.className = 'transit-stop-marker';
      el.style.width = '30px';
      el.style.height = '30px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = selectedStopId === stop.id ? '#10b981' : '#ef4444';
      el.style.border = '3px solid white';
      el.style.cursor = 'pointer';
      el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';

      const marker = new mapboxgl.Marker(el)
        .setLngLat(formatCoordinates(stop.coordinates))
        .addTo(map.current!);

      // Create popup with stop name
      const popup = new mapboxgl.Popup({ offset: 25 }).setText(
        stop.name || `Stop ${stop.code || stop.id}`
      );

      marker.setPopup(popup);

      // Handle click events
      let clickTimer: NodeJS.Timeout | null = null;

      el.addEventListener('click', () => {
        if (clickTimer) {
          clearTimeout(clickTimer);
          clickTimer = null;
          // Double click detected
          onStopDoubleClick(stop);
        } else {
          clickTimer = setTimeout(() => {
            clickTimer = null;
            // Single click
            onStopClick(stop);
          }, 300);
        }
      });

      markersRef.current.set(stop.id, marker);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops, selectedStopId, isMapLoaded]);

  return (
    <div
      ref={mapContainer}
      className="w-full h-full"
      style={{ minHeight: '400px' }}
    />
  );
}

