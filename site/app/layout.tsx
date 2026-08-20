import type { Metadata } from "next";
import { Geist, Geist_Mono, Graduate, Tourney} from "next/font/google";
import { Footer } from "@/components/Footer";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const graduate = Graduate({
  variable: "--font-graduate",
  weight: "400",
  subsets: ["latin"],
});

const tourney = Tourney({
  variable: "--font-tourney",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Road to 3,000",
  description: "Tracking active MLB players chasing the 3,000-hit milestone.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${graduate.variable} ${tourney.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Footer />
      </body>
    </html>
  );
}
