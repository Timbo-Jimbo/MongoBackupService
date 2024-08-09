"use client"

import { Separator } from "@comp/separator";
import { LoadingSpinner } from "@comp/loading-spinner";
import { BackupCard } from "@/components/backup-card";
import { useBackupListQueryClient } from "@lib/providers/backup-list-query-client";
import { InfoCircledIcon } from "@radix-ui/react-icons";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@comp/card";
import { SkeletonList } from "@/components/skeleton-list";

export function BackupList() {

  const backupListQueryClient = useBackupListQueryClient(); 

  const isReady = backupListQueryClient.getAllQuery.isFetched;
  const backups = backupListQueryClient.getAllQuery.data || [];

  return (
    <Card className="flex flex-col w-full">
      <CardHeader>
        <CardTitle className="text-xl font-bold">Backups</CardTitle>
        <CardDescription>
          View and manage your backups.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isReady && backups.length === 0 && <p className="opacity-50 text-sm"><InfoCircledIcon className="w-4 h-4 mr-2 inline" />There are no Backups to show.</p>}
        {!isReady && <SkeletonList count={0} className="h-[4.5rem]"/>}
        {backups.map((backup, index, backups) => (
          <div key={backup.id}>
            <BackupCard 
              key={backup.id}
              backup={backup}
            />
            {index < backups.length - 1 && <Separator className="my-4" />}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}