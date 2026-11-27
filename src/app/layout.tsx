import type { Metadata } from "next";
import { Instrument_Serif, Inter_Tight, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const serif = Instrument_Serif({ variable: "--font-instrument-serif", weight: "400", style: ["normal", "italic"], subsets: ["latin"] });
const sans = Inter_Tight({ variable: "--font-inter-tight", subsets: ["latin", "latin-ext"] });
const mono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Paperwork Path — every bureaucracy is a graph",
  description:
    "See the right order of steps when you move to Spain as an EU citizen. A dependency graph of Spanish paperwork, with the circles and the ways out. Built on Relate.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <head>
        {/* The graph engine is the largest download: start it before the page script asks for it. */}
        <link rel="preload" href="/relate/relate_bg.wasm" as="fetch" type="application/wasm" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
