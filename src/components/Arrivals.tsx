import { format } from 'date-fns';

interface Arrival {
  id: string;
  routeName: string;
  destination: string;
  expectedArrival: Date;
  delay: number;
  type: 'bus' | 'train' | 'tram' | 'ferry';
}

interface ArrivalsProps {
  stopId: string;
  arrivals: Arrival[];
  isLoading: boolean;
}

export default function Arrivals({ stopId, arrivals, isLoading }: ArrivalsProps) {
  if (isLoading) {
    return (
      <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!stopId) {
    return null;
  }

  return (
    <div className="mt-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
        Upcoming Arrivals
      </h2>
      {arrivals.length === 0 ? (
        <p className="text-gray-600 dark:text-gray-400">
          No upcoming arrivals found for this stop.
        </p>
      ) : (
        <div className="space-y-3">
          {arrivals.map((arrival) => (
            <div
              key={arrival.id}
              className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    {arrival.routeName}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    To: {arrival.destination}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {format(arrival.expectedArrival, 'h:mm a')}
                  </p>
                  <p className={`text-sm ${
                    arrival.delay > 0 
                      ? 'text-red-600 dark:text-red-400' 
                      : 'text-green-600 dark:text-green-400'
                  }`}>
                    {arrival.delay > 0 
                      ? `${Math.round(arrival.delay)} min late`
                      : 'On time'
                    }
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 