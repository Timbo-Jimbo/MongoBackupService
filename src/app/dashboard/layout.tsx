"use server"

import { DashboardHeader } from "@/components/dashboard-header";
import { validAuthOrRedirect } from "@actions/utils";
import { TooltipProvider } from "@comp/tooltip";
import { BackupListQueryClientProvider } from "@lib/providers/backup-list-query-client";
import { BackupPoliciesListQueryClientProvider } from "@lib/providers/backup-policies-list-query-client";
import ClientQueryClientProvider from "@lib/providers/client-query-client";
import { MongoDatabaseListQueryClientProvider } from "@lib/providers/mongo-database-list-query-client";
import { TaskListQueryClientProvider } from "@lib/providers/task-list-query-client";


export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  validAuthOrRedirect();

  return (
    <ClientQueryClientProvider>
      <MongoDatabaseListQueryClientProvider>
        <BackupPoliciesListQueryClientProvider>
          <BackupListQueryClientProvider>
            <TaskListQueryClientProvider>
              <TooltipProvider>
                <div className="flex flex-col w-full h-full">
                  <DashboardHeader/>
                  {children}
                </div>
              </TooltipProvider>
            </TaskListQueryClientProvider>
          </BackupListQueryClientProvider>
        </BackupPoliciesListQueryClientProvider>
      </MongoDatabaseListQueryClientProvider>
    </ClientQueryClientProvider>
    
  );
}
