import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "我靠模拟成仙",
  description: "AI 驱动的修仙模拟器手游，以年龄为引，天道执笔，演绎你的修真之路。",
  keywords: ["修仙", "模拟器", "修真", "AI", "Xianxia", "Cultivation"],
  authors: [{ name: "天道" }],
  icons: {
  },
  openGraph: {
    title: "我靠模拟成仙",
    description: "AI 驱动的文字修仙模拟游戏",
    siteName: "我靠模拟成仙",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
