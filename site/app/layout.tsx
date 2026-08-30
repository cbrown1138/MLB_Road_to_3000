import type { Metadata } from "next";
import { Geist, Geist_Mono, Graduate, Tourney} from "next/font/google";
import Script from "next/script";
import { Footer } from "@/components/Footer";
import "./globals.css";

const GA_MEASUREMENT_ID = "G-ENVP84QLSY";

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
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
        {children}
        <Footer />
      </body>
    </html>
  );
}
