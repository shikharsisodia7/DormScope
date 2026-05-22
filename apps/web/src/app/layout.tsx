import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Header } from "@/components/layout/header";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "DormScope — Nationwide College Dorm Intelligence",
  description:
    "Search, compare, score, and map college dorms across the United States. Zillow meets RateMyProfessors for student housing.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans min-h-screen antialiased`}>
        <Providers>
          <Header />
          <main>{children}</main>
          <footer className="border-t mt-16 py-8 text-center text-sm text-muted-foreground">
            <p>DormScope · Public data only — verify with official university housing offices.</p>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
