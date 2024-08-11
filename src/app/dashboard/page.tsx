'use client'

import { TaskList } from "./task-list"
import { MongoDatabaseList } from "./mongo-database-list";
import { BackupList } from "./backup-list";

export default function DashboardPage() {

  return (
    <main className="flex flex-col place-items-center justify-center p-4 lg:py-8">
      <div className="flex flex-col place-items-center gap-4 lg:gap-8 w-full max-w-screen-lg">
        <MongoDatabaseList/>
        <BackupList/>
        <TaskList/>
      </div>
    </main>    
  );
}
