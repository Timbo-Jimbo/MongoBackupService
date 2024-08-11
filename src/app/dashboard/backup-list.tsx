"use client"

import { Separator } from "@comp/separator";
import { LoadingSpinner } from "@comp/loading-spinner";
import { BackupCard } from "@/components/backup-card";
import { useBackupListQueryClient } from "@lib/providers/backup-list-query-client";
import { InfoCircledIcon } from "@radix-ui/react-icons";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@comp/card";
import { SkeletonList } from "@/components/skeleton-list";
import { Skeleton } from "@comp/skeleton";

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
        {isReady && backups.length === 0 && <p className="text-muted-foreground text-sm"><InfoCircledIcon className="w-4 h-4 mr-2 inline" />There are no Backups to show.</p>}
        {!isReady && (
          <SkeletonList count={backupListQueryClient.skeletonCount} className="h-[7rem]">
          {/* <div className="flex flex-col">
            <div className="flex flex-row place-content-between">
              <Skeleton className="h-5 w-2/5" />
              <Skeleton className="h-5 w-1/4" />
            </div>
            <div className="flex flex-row place-content-between mt-6 mb-3">
              <Skeleton className="h-12 w-1/6" />
              <Skeleton className="h-12 w-1/6" />
              <Skeleton className="h-12 w-1/6" />
              <Skeleton className="h-12 w-1/6" />
            </div>
          </div> */}
          </SkeletonList>
        )}
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