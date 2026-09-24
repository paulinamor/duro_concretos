import type { Metadata } from "next";
import { Geist, Geist_Mono, Manrope } from "next/font/google";
import ToastCenter from "@/components/ToastCenter";
import ThemeSync from "@/components/ThemeSync";
import NumberInputFix from "@/components/NumberInputFix";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  preload: false,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: false,
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  preload: false,
});

export const metadata: Metadata = {
  title: "Duro Concretos ERP",
  description: "Sistema de gestión empresarial Duro Concretos",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} ${manrope.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <TooltipProvider>
          <ThemeSync />
          <NumberInputFix />
          {children}
          <ToastCenter />
        </TooltipProvider>
      </body>
    </html>
  );
}
