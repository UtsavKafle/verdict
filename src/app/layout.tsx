import type { Metadata, Viewport } from "next";
import { Archivo_Black, Archivo, Space_Mono } from "next/font/google";
import { AuthBootstrap } from "@/components/auth-bootstrap";
import { ServiceWorkerRegistrar } from "@/components/service-worker-registrar";
import "./globals.css";

const archivoBlack = Archivo_Black({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-archivo-black",
});

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
});

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-space-mono",
});

export const metadata: Metadata = {
  title: "Verdict",
  description: "Cast your vote. See the crowd's verdict.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Verdict",
  },
  // Next 16 emits the standardized `mobile-web-app-capable`; also emit the
  // legacy apple-prefixed tag so full-screen standalone works on older iOS.
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#f4ede2",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${archivoBlack.variable} ${archivo.variable} ${spaceMono.variable} h-full antialiased`}
    >
      {/* Fixed height (not min-height) + overflow-hidden makes body a fixed,
          non-scrolling frame — the dynamic viewport unit accounts for mobile
          browser chrome (address bar), and capping+clipping here is what stops
          the page itself from ever double-scrolling alongside an inner scroll
          container. Set via inline style, not the h-dvh utility class — that
          class wasn't reliably compiling in this dev environment and silently
          left body unbounded, which is exactly what caused the next reel to
          peek in below the first (this same "Tailwind utility silently doesn't
          apply" failure mode showed up earlier for h-20/w-20/object-cover too;
          inline style sidesteps it entirely for anything load-bearing). */}
      <body
        className="overflow-hidden bg-ink font-body flex flex-col"
        style={{ height: '100dvh' }}
      >
        <AuthBootstrap />
        <ServiceWorkerRegistrar />
        <div
          id="app-shell"
          className="relative mx-auto w-full flex-1 overflow-y-auto bg-cream sm:my-6 sm:h-[812px] sm:max-w-[390px] sm:flex-none sm:rounded-card sm:shadow-2xl sm:overflow-hidden"
        >
          {children}
        </div>
      </body>
    </html>
  );
}
