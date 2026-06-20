import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "我靠模拟成仙",
  description: "天机推衍的修仙模拟器手游，以年龄为引，天道执笔，演绎你的修真之路。",
  keywords: ["修仙", "模拟器", "修真", "Xianxia", "Cultivation"],
  authors: [{ name: "天道" }],
  icons: {
  },
  openGraph: {
    title: "我靠模拟成仙",
    description: "天机推衍的文字修仙模拟游戏",
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
        className="antialiased bg-background text-foreground"
      >
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
