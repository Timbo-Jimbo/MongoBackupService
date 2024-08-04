"use server"

import { validAuthOrRedirect } from "@actions/common";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  validAuthOrRedirect();
  return children;
}
