import { NextRequest, NextResponse } from 'next/server';
import { geocodeAddress } from '@/lib/geocoding';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json(
      { error: 'Query parameter "q" is required' },
      { status: 400 }
    );
  }

  try {
    // Use Mapbox Geocoding API directly
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    
    if (!token) {
      return NextResponse.json(
        { error: 'Mapbox token not configured' },
        { status: 500 }
      );
    }

    const url = new URL(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`
    );
    url.searchParams.append('access_token', token);
    url.searchParams.append('limit', '5');
    url.searchParams.append('proximity', '-122.3321,47.6062'); // Seattle center

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Mapbox API error: ${response.status}`);
    }

    const data = await response.json();

    const suggestions = (data.features || []).map((feature: any) => ({
      place_name: feature.place_name,
      center: feature.center,
    }));

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error('Error in geocoding API:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to geocode address',
      },
      { status: 500 }
    );
  }
}


