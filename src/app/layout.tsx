import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HLDraw.io",
  description: "Design high-fidelity system diagrams collaboratively in real-time using AI assistance.",
  openGraph: {
    title: "HLDraw.io",
    description: "Design high-fidelity system diagrams collaboratively in real-time using AI assistance.",
    images: [
      {
        url: "/hl_draw_og.png",
        width: 1200,
        height: 630,
        alt: "HLDraw",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
