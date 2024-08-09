import type { Metadata } from "next";

import { cn } from "@lib/utils";
import LoginExtender from "@/components/login-extender";
import { AR_One_Sans as Font } from "next/font/google";
import "./globals.css";
import { Suspense } from "react";
import { Toaster } from "@comp/sonner";

const font = Font({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
})

export const metadata: Metadata = {
  title: "Railway MongoDB Backups",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  return (
    <html lang="en" className="dark">
      <body className={cn(
        "min-h-screen bg-background antialiased",
        font.className,
      )}>
          <LoginExtender>
            <Suspense>
              {children}
            </Suspense>
            <Toaster position="top-right" />
          </LoginExtender>
      </body>
    </html>
  );
}
