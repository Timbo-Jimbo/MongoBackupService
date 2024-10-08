import type { Metadata, Viewport } from "next";

import { cn } from "@lib/utils";
import LoginExtender from "@/components/login-extender";
import { AR_One_Sans as Font } from "next/font/google";
import "./globals.css";
import { Suspense } from "react";
import { Toaster } from "@comp/sonner";
import { GlobalFooter } from "@/components/global-footer";

const font = Font({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
})

export const metadata: Metadata = {
  title: "Mongo Backup Service",
};

export const viewport: Viewport = {
  themeColor: "#10B981",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  return (
    <html lang="en" className="dark">
      <body className={cn(
        "min-h-screen bg-black antialiased",
        "bg-gradient-to-tr from-emerald-500/10 to-slate-800/40",
        font.className,
      )}>
          <LoginExtender>
            <Suspense>
              <div className="flex flex-col min-h-screen">
                <div className="flex flex-grow">
                  {children}
                </div>
                <GlobalFooter />
              </div>
            </Suspense>
            <Toaster position="top-right" />
          </LoginExtender>
      </body>
    </html>
  );
}
