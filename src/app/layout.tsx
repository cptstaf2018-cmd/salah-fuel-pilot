import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";
import "@/styles/tokens.css";
import "@/styles/console.css";

/**
 * Plex Arabic carries the institutional tone the console wants and ships
 * tabular figures, which is what keeps the numeric columns aligned.
 */
const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-arabic",
  display: "swap"
});

export const metadata: Metadata = {
  title: "منظومة وقود صلاح الدين الذكية",
  description: "Salah Al-Din Smart Fuel Management System"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className={plexArabic.variable}>
      <body>{children}</body>
    </html>
  );
}
