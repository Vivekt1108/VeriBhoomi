import type { Metadata } from "next";
import { Spectral, Inter } from "next/font/google";
import "./globals.css";

// serif for headings (officialdom/trust), sans for data/UI
const serif = Spectral({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-serif",
});
const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "VeriBhoomi — Transparent Land Records",
  description:
    "Surface hidden contradictions across property documents, parties and bureaucracy levels. Detect fraud transparently, with a human officer in the loop.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
