import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Dashing Arrivals - Find Your Nearest Transit Stops',
  description: 'Find the nearest transit stops and view real-time arrival information in Seattle',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}


