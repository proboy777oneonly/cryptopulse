import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const interSans = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "CryptoPulse — крипто-скринер реального времени",
  description:
    "Профессиональный крипто-скринер: плотности, движения, арбитраж и новости с 8 бирж в реальном времени. Голосовые уведомления, 4 темы, мгновенные алерты.",
  keywords: ["крипто", "скринер", "плотности", "арбитраж", "трейдинг", "binance", "bybit", "okx"],
  icons: { icon: "/logo.svg" },
};

export const viewport: Viewport = {
  themeColor: "#070b16",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body
        className={`${interSans.variable} ${jetbrainsMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
      </body>
    </html>
  );
}
