"use server"

import { DashboardHeader } from "@/components/dashboard-header";
import { validAuthOrRedirect } from "@actions/utils";
import { TooltipProvider } from "@comp/tooltip";
import { BackupListQueryClientProvider } from "@lib/providers/backup-list-query-client";
import ClientQueryClientProvider from "@lib/providers/client-query-client";
import { MongoDatabaseListQueryClientProvider } from "@lib/providers/mongo-database-list-query-client";
import { TaskListQueryClientProvider } from "@lib/providers/task-list-query-client";
import Image from "next/image";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  validAuthOrRedirect();

  return (
    <ClientQueryClientProvider>
      <MongoDatabaseListQueryClientProvider>
        <BackupListQueryClientProvider>
          <TaskListQueryClientProvider>
            <TooltipProvider>
              <DashboardHeader/>
              {children}
            </TooltipProvider>
          </TaskListQueryClientProvider>
        </BackupListQueryClientProvider>
      </MongoDatabaseListQueryClientProvider>
    </ClientQueryClientProvider>
    
  );
}
