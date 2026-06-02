import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppProviders } from "@/components/providers/AppProviders";
import { appConfig } from "@/lib/config/env";

export const metadata: Metadata = {
  title: `${appConfig.appName} — Gym Management SaaS`,
  description:
    "Premium, mobile-first gym management: members, plans, renewals, expiry tracking, leads, digital cards and reports.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0b0f17",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
