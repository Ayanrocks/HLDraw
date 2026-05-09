import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import theme from "../config/theme.config.json";

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
      <head>
        <style>{`
          :root {
            --primary-300: ${theme.colors.primary["300"]};
            --primary-400: ${theme.colors.primary["400"]};
            --primary-500: ${theme.colors.primary["500"]};
            --primary-600: ${theme.colors.primary["600"]};
            --primary-700: ${theme.colors.primary["700"]};
            --secondary-300: ${theme.colors.secondary["300"]};
            --secondary-400: ${theme.colors.secondary["400"]};
            --secondary-500: ${theme.colors.secondary["500"]};
            --secondary-600: ${theme.colors.secondary["600"]};
            --secondary-700: ${theme.colors.secondary["700"]};
            --accent-300: ${theme.colors.accent["300"]};
            --accent-400: ${theme.colors.accent["400"]};
            --accent-500: ${theme.colors.accent["500"]};
            --accent-600: ${theme.colors.accent["600"]};
            --accent-700: ${theme.colors.accent["700"]};
          }
        `}</style>
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
