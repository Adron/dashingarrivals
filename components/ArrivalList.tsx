'use client';

import type { Arrival } from '@/lib/types';

interface ArrivalListProps {
  arrivals: Arrival[];
  isLoading?: boolean;
}

export default function ArrivalList({
  arrivals,
  isLoading = false,
}: ArrivalListProps) {
  if (isLoading) {
    return (
      <div className="p-4 bg-white rounded-lg shadow-md">
        <div className="flex items-center justify-center py-4">
          <svg
            className="animate-spin h-6 w-6 text-blue-600"
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
          <span className="ml-2 text-gray-600">Loading arrivals...</span>
        </div>
      </div>
    );
  }

  if (arrivals.length === 0) {
    return (
      <div className="p-4 bg-white rounded-lg shadow-md">
        <p className="text-gray-500 text-center">No arrivals scheduled</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <ul className="divide-y divide-gray-200">
        {arrivals.map((arrival, index) => (
          <li key={index} className="p-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg text-blue-600">
                    {arrival.routeShortName}
                  </span>
                  <span className="text-sm text-gray-500">
                    {arrival.routeLongName}
                  </span>
                </div>
                <p className="text-sm text-gray-700 mt-1">
                  To: {arrival.tripHeadsign}
                </p>
              </div>
              <div className="text-right">
                {arrival.minutesUntilArrival !== undefined && (
                  <div>
                    {arrival.minutesUntilArrival === 0 ? (
                      <span className="text-lg font-bold text-green-600">
                        Arriving
                      </span>
                    ) : (
                      <span className="text-lg font-bold text-gray-900">
                        {arrival.minutesUntilArrival} min
                      </span>
                    )}
                    {arrival.status === 'predicted' && (
                      <span className="block text-xs text-green-600 mt-1">
                        Live
                      </span>
                    )}
                    {arrival.status === 'scheduled' && (
                      <span className="block text-xs text-gray-500 mt-1">
                        Scheduled
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}


