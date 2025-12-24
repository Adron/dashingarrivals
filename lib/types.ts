// Location types
export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Location {
  coordinates: Coordinates;
  address?: string;
}

// Transit stop types
export interface TransitStop {
  id: string;
  name: string;
  code?: string;
  coordinates: Coordinates;
  direction?: string;
  distance?: number; // in meters
}

// Arrival types
export interface Arrival {
  routeId: string;
  routeShortName: string;
  routeLongName: string;
  tripHeadsign: string;
  predictedArrivalTime?: number; // Unix timestamp in milliseconds
  scheduledArrivalTime: number; // Unix timestamp in milliseconds
  minutesUntilArrival?: number;
  status?: 'scheduled' | 'predicted' | 'delayed';
}

// API response types
export interface OneBusAwayStopResponse {
  code: number;
  currentTime: number;
  data: {
    list: Array<{
      id: string;
      lat: number;
      lon: number;
      name: string;
      code?: string;
      direction?: string;
      locationType?: number;
    }>;
  };
}

export interface OneBusAwayArrivalResponse {
  code: number;
  currentTime: number;
  data: {
    entry: {
      stopId: string;
      arrivalsAndDepartures: Array<{
        routeId: string;
        routeShortName: string;
        routeLongName: string;
        tripHeadsign: string;
        predictedArrivalTime?: number;
        scheduledArrivalTime: number;
        arrivalEnabled: boolean;
        departureEnabled: boolean;
      }>;
    };
  };
}

export interface GeocodingResponse {
  features: Array<{
    place_name: string;
    center: [number, number]; // [lng, lat]
    geometry: {
      type: string;
      coordinates: [number, number];
    };
  }>;
}

// Component prop types
export interface MapProps {
  center: Coordinates;
  stops: TransitStop[];
  selectedStopId?: string;
  onStopClick: (stop: TransitStop) => void;
  onStopDoubleClick: (stop: TransitStop) => void;
}

export interface ArrivalListProps {
  arrivals: Arrival[];
  isLoading?: boolean;
}

export interface StopDetailProps {
  stop: TransitStop;
  arrivals: Arrival[];
  isLoading?: boolean;
}


