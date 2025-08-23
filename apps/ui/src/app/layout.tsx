import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "devart.ai Dashboard",
  description: "Autonomous AI Development Hub",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-gray-900 text-white">{children}</body>
    </html>
  );
}