import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://dormscope.app"),
  title: {
    default: "DormScope — Find your best college dorm",
    template: "%s · DormScope",
  },
  description:
    "Choose your college, say what matters, and get dorms ranked for you. Honest coverage from public housing data.",
  openGraph: {
    title: "DormScope — Find your best college dorm",
    description:
      "Personalized dorm rankings grounded in public university housing data. Independent — always verify with your school.",
    type: "website",
    siteName: "DormScope",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${dmSans.variable} ${fraunces.variable} min-h-screen font-sans antialiased`}>
        <Providers>
          <Header />
          <main id="main">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
