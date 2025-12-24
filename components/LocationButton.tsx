'use client';

import { useEffect } from 'react';
import { useLocation } from '@/hooks/useLocation';

interface LocationButtonProps {
  onLocationFound: (coordinates: { lat: number; lng: number }) => void;
  className?: string;
}

export default function LocationButton({
  onLocationFound,
  className = '',
}: LocationButtonProps) {
  const { coordinates, isLoading, error, getCurrentLocation, clearError } = useLocation();

  useEffect(() => {
    if (coordinates) {
      onLocationFound(coordinates);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordinates]);

  const handleClick = async () => {
    clearError();
    await getCurrentLocation();
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={`
        px-4 py-2 rounded-lg font-medium
        bg-blue-600 text-white
        hover:bg-blue-700
        disabled:bg-gray-400 disabled:cursor-not-allowed
        transition-colors
        ${className}
      `}
      aria-label="Get current location"
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <svg
            className="animate-spin h-5 w-5"
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
          Finding location...
        </span>
      ) : (
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
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          Use My Location
        </span>
      )}
      {error && (
        <span className="block mt-1 text-sm text-red-600">{error}</span>
      )}
    </button>
  );
}

