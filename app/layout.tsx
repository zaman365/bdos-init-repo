import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "BDOS — Your stage. Your shop.",
  description: "দেখো · কিনো · কামাও — Bangladesh On Stage",
  robots: { index: false, follow: false },
  icons: { icon: "/icon.svg" },
  manifest: "/manifest.webmanifest",
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0A0C0B",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bn">
      <body>{children}</body>
    </html>
  );
}
