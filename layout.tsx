import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nexsett Prospect & Commission CRM",
  description: "Secure prospect, commission and commercial-governance management for Nexsett."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
