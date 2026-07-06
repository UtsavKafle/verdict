import type { Metadata } from "next";
import { Archivo_Black, Archivo, Space_Mono } from "next/font/google";
import { AuthBootstrap } from "@/components/auth-bootstrap";
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
      <body className="min-h-dvh bg-ink font-body flex flex-col">
        <AuthBootstrap />
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
