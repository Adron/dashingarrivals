import { NextRequest, NextResponse } from 'next/server';
import { findNearestStops } from '@/lib/onebusaway';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');

  if (!lat || !lng) {
    return NextResponse.json(
      { error: 'Latitude and longitude parameters are required' },
      { status: 400 }
    );
  }

  const latitude = parseFloat(lat);
  const longitude = parseFloat(lng);

  if (isNaN(latitude) || isNaN(longitude)) {
    return NextResponse.json(
      { error: 'Invalid latitude or longitude values' },
      { status: 400 }
    );
  }

  try {
    const stops = await findNearestStops(
      { lat: latitude, lng: longitude },
      3
    );

    return NextResponse.json({ stops });
  } catch (error) {
    console.error('Error fetching stops:', error);
    
    // Return empty array instead of error to allow graceful degradation
    // In a production app, you might want to implement GTFS fallback here
    return NextResponse.json(
      {
        stops: [],
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch transit stops',
      },
      { status: 500 }
    );
  }
}


