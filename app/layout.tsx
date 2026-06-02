import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import ToastCenter from "@/components/ToastCenter";
import ThemeSync from "@/components/ThemeSync";
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[#1A1A1A] text-white">
        <ThemeSync />
        {children}
        <ToastCenter />
      </body>
    </html>
  );
}
