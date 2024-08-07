'use client'

import { LogoutButton } from "@app/login/components"
import { TaskList } from "./task-list"
import { MongoDatabaseList } from "./mongo-database-list";
import { BackupList } from "./backup-list";
import { MongoDatabaseListQueryClientProvider } from "@lib/providers/mongo-database-list-query-client";
import { BackupListQueryClientProvider } from "@lib/providers/backup-list-query-client";
import { TaskListQueryClientProvider } from "@lib/providers/task-list-query-client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export default function DashboardPage() {

  const queryClient = new QueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <MongoDatabaseListQueryClientProvider>
        <BackupListQueryClientProvider>
          <TaskListQueryClientProvider>
            <main className="flex min-h-screen flex-col place-items-center justify-center p-24">
            
              <div className="flex flex-col place-items-center gap-8 w-full max-w-3xl">
                <div className="flex flex-col w-full gap-4">
                  <h1>Welcome back!</h1>
                  <LogoutButton />
                </div>
                <MongoDatabaseList/>
                <BackupList/>
                <TaskList/>
              </div>
            </main>
          </TaskListQueryClientProvider>
        </BackupListQueryClientProvider>
      </MongoDatabaseListQueryClientProvider>
    </QueryClientProvider>
  );
}
