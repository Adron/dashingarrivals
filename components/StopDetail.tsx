'use client';

import Link from 'next/link';
import type { TransitStop } from '@/lib/types';
import ArrivalList from './ArrivalList';
import type { Arrival } from '@/lib/types';

interface StopDetailProps {
  stop: TransitStop;
  arrivals: Arrival[];
  isLoading?: boolean;
}

export default function StopDetail({
  stop,
  arrivals,
  isLoading = false,
}: StopDetailProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Link
            href="/"
            className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Back to Map
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{stop.name}</h1>
          {stop.code && (
            <p className="text-sm text-gray-500 mt-1">Stop Code: {stop.code}</p>
          )}
          {stop.direction && (
            <p className="text-sm text-gray-500">Direction: {stop.direction}</p>
          )}
          {stop.distance !== undefined && (
            <p className="text-sm text-gray-500">
              Distance: {Math.round(stop.distance)}m away
            </p>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Next Arrivals (Next Hour)
        </h2>
        <ArrivalList arrivals={arrivals} isLoading={isLoading} />
      </div>
    </div>
  );
}


