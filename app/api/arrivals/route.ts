import { NextRequest, NextResponse } from 'next/server';
import {
  getStopArrivals,
  filterArrivalsNextHour,
} from '@/lib/onebusaway';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const stopId = searchParams.get('stopId');
  const limitParam = searchParams.get('limit');
  const filterNextHourParam = searchParams.get('filterNextHour');

  if (!stopId) {
    return NextResponse.json(
      { error: 'Stop ID parameter is required' },
      { status: 400 }
    );
  }

  const limit = limitParam ? parseInt(limitParam, 10) : undefined;
  const filterNextHour = filterNextHourParam === 'true';

  try {
    let arrivals = await getStopArrivals(stopId);

    // Filter to next hour if requested
    if (filterNextHour) {
      arrivals = filterArrivalsNextHour(arrivals);
    }

    // Apply limit if specified
    if (limit && limit > 0) {
      arrivals = arrivals.slice(0, limit);
    }

    return NextResponse.json({ arrivals });
  } catch (error) {
    console.error('Error fetching arrivals:', error);
    return NextResponse.json(
      {
        arrivals: [],
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch arrivals',
      },
      { status: 500 }
    );
  }
}


