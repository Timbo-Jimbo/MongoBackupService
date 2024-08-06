"use server"

import ClientSideQueryClientProvider from "@/components/providers/client-side-query-client-provider";
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
      <ClientSideQueryClientProvider>
        {children}
      </ClientSideQueryClientProvider>
    </TooltipProvider>
  );
}
