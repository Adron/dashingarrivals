# Dashing Arrivals

A Next.js web application that helps users in Seattle find the nearest transit stops and view real-time arrival information.

## Features

- **Automatic Location Detection**: Uses GPS to find your current location, or enter an address manually
- **Nearest Stops**: Displays the 3 nearest transit stops on an interactive map
- **Real-time Arrivals**: View the next 3 arrivals for any stop, or see all arrivals in the next hour
- **Interactive Map**: Built with Mapbox GL JS for smooth, responsive map interactions
- **Mobile-First Design**: Responsive UI that works great on mobile and desktop

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- Mapbox account and access token ([Get one here](https://account.mapbox.com/))
- OneBusAway API access (public API available, no key required for basic usage)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd dashingarrivals
```

2. Install dependencies:
```bash
npm install
# or
yarn install
# or
pnpm install
```

3. Create a `.env.local` file in the root directory:
```env
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_token_here
ONEBUSAWAY_BASE_URL=https://api.pugetsound.onebusaway.org
ONEBUSAWAY_API_KEY=your_onebusaway_key_if_required
```

4. Run the development server:
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
dashingarrivals/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── stop/              # Stop detail pages
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Main map page
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── Map.tsx           # Mapbox map component
│   ├── ArrivalList.tsx   # Arrival times list
│   ├── LocationButton.tsx # GPS location button
│   ├── AddressInput.tsx   # Address search input
│   └── StopDetail.tsx    # Stop detail view
├── hooks/                # Custom React hooks
│   ├── useLocation.ts    # GPS location hook
│   ├── useNearestStops.ts # Nearest stops hook
│   └── useArrivals.ts    # Arrivals polling hook
└── lib/                  # Utility libraries
    ├── onebusaway.ts     # OneBusAway API client
    ├── mapbox.ts         # Mapbox utilities
    ├── geocoding.ts      # Geocoding functions
    └── types.ts          # TypeScript types
```

## Usage

1. **Get Your Location**: Click "Use My Location" to automatically detect your GPS location, or click "Address" to enter a specific address
2. **View Stops**: The map will display the 3 nearest transit stops
3. **See Arrivals**: Tap a stop marker to see the next 3 arrivals below the map
4. **View Details**: Double-tap a stop marker to navigate to a detail page showing all arrivals in the next hour

## Technologies Used

- **Next.js 14+** - React framework with App Router
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Utility-first CSS framework
- **Mapbox GL JS** - Interactive maps
- **OneBusAway API** - Transit data for Seattle area

## API Routes

- `/api/location` - Geocode addresses using Mapbox
- `/api/stops` - Find nearest transit stops
- `/api/arrivals` - Get arrivals for a specific stop

## Environment Variables

- `NEXT_PUBLIC_MAPBOX_TOKEN` - Required. Your Mapbox access token
- `ONEBUSAWAY_BASE_URL` - Optional. Defaults to Puget Sound OneBusAway API
- `ONEBUSAWAY_API_KEY` - Optional. Only needed if the API requires authentication

## Building for Production

```bash
npm run build
npm start
```

## License

MIT


