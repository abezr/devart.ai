import type { Metadata } from "next";
import "./globals.css";
import { useEffect } from "react";

export const metadata: Metadata = {
  title: "devart.ai Dashboard",
  description: "Autonomous AI Development Hub",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  useEffect(() => {
    // Initialize OpenTelemetry only on the client side
    if (typeof window !== 'undefined') {
      try {
        const { initializeOpenTelemetry } = require('../lib/opentelemetry');
        initializeOpenTelemetry();
      } catch (error) {
        console.error('Failed to initialize OpenTelemetry:', error);
      }
    }
  }, []);

  return (
    <html lang="en">
      <body className="bg-gray-900 text-white">{children}</body>
    </html>
  );
}