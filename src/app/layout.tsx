import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "@maptiler/sdk/dist/maptiler-sdk.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Dashing Arrivals - Transit Stop Finder",
  description: "Find nearby transit stops and real-time arrival information",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className={`${inter.className} h-full antialiased dark:bg-gray-900`}>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          {children}
        </div>
      </body>
    </html>
  );
}
