"use client"

import { Separator } from "@comp/separator";
import { LoadingSpinner } from "@comp/loading-spinner";
import { BackupCard } from "@/components/backup-card";
import { useBackupListQueryClient } from "@lib/providers/backup-list-query-client";

export function BackupList() {

  const backupListQueryClient = useBackupListQueryClient(); 

  const isReady = backupListQueryClient.getAllQuery.isFetched;
  const backups = backupListQueryClient.getAllQuery.data || [];

  return (
    <div className="flex flex-col w-full gap-4">
      <h2 className="text-xl font-semibold">Backups</h2>
      {isReady && backups.length === 0 && <p className="opacity-50 text-sm">There are no Backups to show.</p>}
      {!isReady && (
        <div className="flex flex-col m-4 place-items-center justify-center">
          <LoadingSpinner className="w-10 h-10 opacity-50" />
        </div>
      )}
      {backups.map((backup, index, backups) => (
        <div key={backup.id}>
          <BackupCard 
            key={backup.id}
            backup={backup}
          />
          {index < backups.length - 1 && <Separator />}
        </div>
      ))}
    </div>
  );
}