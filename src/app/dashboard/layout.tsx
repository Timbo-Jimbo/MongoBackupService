"use server"

import { validAuthOrRedirect } from "@actions/utils";
import { TooltipProvider } from "@comp/tooltip";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  validAuthOrRedirect();

  return (
    <TooltipProvider>
      {children}
    </TooltipProvider>
  );
}
