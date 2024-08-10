'use client'

import { LogoutButton } from "@app/login/components"
import { TaskList } from "./task-list"
import { MongoDatabaseList } from "./mongo-database-list";
import { BackupList } from "./backup-list";
import { Separator } from "@comp/separator";
import { Card, CardContent } from "@comp/card";

export default function DashboardPage() {

  return (
    <main className="flex flex-col place-items-center justify-center px-4 lg:py-12">
      <div className="flex flex-col place-items-center gap-8 w-full max-w-screen-lg">
        <MongoDatabaseList/>
        <BackupList/>
        <TaskList/>
      </div>
    </main>    
  );
}
