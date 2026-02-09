import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { initPerformanceMonitoring } from "../utils/performance";
import RegisterServiceWorker from "../components/RegisterServiceWorker";
import { config } from "../utils/config";
import { AuthProvider } from "../contexts/AuthContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: 'swap',
  preload: true,
  fallback: ['system-ui', 'arial'],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: 'swap',
  preload: true,
  fallback: ['monospace'],
});

export const metadata: Metadata = {
  title: "MotionRep",
  description: "MotionRep - Professional Sales Management System. Automate order processing, track sales representatives, manage inventory, and streamline your business operations with our comprehensive dashboard solution.",
  keywords: "sales management, order processing, inventory management, sales representatives, business automation, MotionRep",
  authors: [{ name: "MotionRep Team" }],
  creator: "MotionRep",
  publisher: "MotionRep",
  robots: "index, follow",
  openGraph: {
    title: "MotionRep - Sales Management System",
    description: "Professional sales management system for order processing, inventory tracking, and business automation.",
    type: "website",
    locale: "en_US",
    siteName: "MotionRep",
  },
  twitter: {
    card: "summary_large_image",
    title: "MotionRep - Sales Management System",
    description: "Professional sales management system for order processing, inventory tracking, and business automation.",
  },
  icons: {
    icon: [
      {
        url: "/MotionRep.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        url: "/MotionRep.png",
        sizes: "16x16",
        type: "image/png",
      },
      {
        url: "/MotionRep.png",
        sizes: "48x48",
        type: "image/png",
      },
      {
        url: "/MotionRep.png",
        sizes: "96x96",
        type: "image/png",
      },
      {
        url: "/MotionRep.png",
        sizes: "128x128",
        type: "image/png",
      },
      {
        url: "/MotionRep.png",
        sizes: "256x256",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/MotionRep.png",
        sizes: "180x180",
        type: "image/png",
      },
      {
        url: "/MotionRep.png",
        sizes: "152x152",
        type: "image/png",
      },
      {
        url: "/MotionRep.png",
        sizes: "144x144",
        type: "image/png",
      },
      {
        url: "/MotionRep.png",
        sizes: "120x120",
        type: "image/png",
      },
      {
        url: "/MotionRep.png",
        sizes: "114x114",
        type: "image/png",
      },
      {
        url: "/MotionRep.png",
        sizes: "76x76",
        type: "image/png",
      },
      {
        url: "/MotionRep.png",
        sizes: "72x72",
        type: "image/png",
      },
      {
        url: "/MotionRep.png",
        sizes: "60x60",
        type: "image/png",
      },
      {
        url: "/MotionRep.png",
        sizes: "57x57",
        type: "image/png",
      },
    ],
    shortcut: "/MotionRep.png",
    other: [
      {
        rel: "mask-icon",
        url: "/MotionRep.png",
        color: "#8b5cf6",
      },
    ],
  },
  other: {
    'theme-color': '#8b5cf6',
    'msapplication-TileColor': '#8b5cf6',
    'msapplication-TileImage': '/MotionRep.png',
    // Security headers
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Initialize performance monitoring on client side
  if (typeof window !== 'undefined') {
    initPerformanceMonitoring();
  }

  return (
    <html lang="en">
      <head>
        {/* Preload critical resources */}
        <link rel="preconnect" href={config.backendUrl} />
        <link rel="dns-prefetch" href={config.backendUrl} />
        
        {/* Additional Favicon Support */}
        <link rel="icon" type="image/png" sizes="32x32" href="/MotionRep.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/MotionRep.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/MotionRep.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/MotionRep.png" />
        <link rel="apple-touch-icon" sizes="144x144" href="/MotionRep.png" />
        <link rel="apple-touch-icon" sizes="120x120" href="/MotionRep.png" />
        <link rel="apple-touch-icon" sizes="114x114" href="/MotionRep.png" />
        <link rel="apple-touch-icon" sizes="76x76" href="/MotionRep.png" />
        <link rel="apple-touch-icon" sizes="72x72" href="/MotionRep.png" />
        <link rel="apple-touch-icon" sizes="60x60" href="/MotionRep.png" />
        <link rel="apple-touch-icon" sizes="57x57" href="/MotionRep.png" />
        <link rel="shortcut icon" href="/MotionRep.png" />
        
        {/* Windows Tile Support */}
        <meta name="msapplication-TileColor" content="#8b5cf6" />
        <meta name="msapplication-TileImage" content="/MotionRep.png" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        
        {/* Android Chrome Support */}
        <meta name="theme-color" content="#8b5cf6" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="MotionRep" />
        
        {/* Web App Manifest */}
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <RegisterServiceWorker />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
