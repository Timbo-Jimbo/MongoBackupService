"use server"

import ClientSideQueryClientProvider from "@/components/client-side-query-client-provider";
import { validAuthOrRedirect } from "@actions/common";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  validAuthOrRedirect();

  return (
    <ClientSideQueryClientProvider>
      {children}
    </ClientSideQueryClientProvider>
  );
}
