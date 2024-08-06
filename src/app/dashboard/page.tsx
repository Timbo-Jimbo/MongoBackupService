'use client'

import { LogoutButton } from "@app/login/components"
import { TaskList } from "./task-list"
import { MongoDatabaseList } from "./mongo-database-list";
import { BackupList } from "./backup-list";
import { MongoDatabaseListQueryClientProvider } from "@/components/providers/mongo-database-list-query-client";

export default function DashboardPage() {

  return (
      <MongoDatabaseListQueryClientProvider>
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
      </MongoDatabaseListQueryClientProvider>
  );
}
