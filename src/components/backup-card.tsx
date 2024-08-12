import { deleteBackup } from "@actions/backups";
import { BackupWithRelations } from "@backend/db/backup.schema";
import { AlertDialog, AlertGenericConfirmationDialogContent } from "@comp/alert-dialog";
import { Button } from "@comp/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@comp/dropdown-menu";
import { toast, toastForActionResult } from "@comp/toasts";
import { ChartPieIcon, ClockIcon, DocumentIcon, Square3Stack3DIcon, TableCellsIcon } from "@heroicons/react/20/solid";
import { CursorArrowRaysIcon, TrashIcon, TagIcon, CogIcon, SparklesIcon, LinkIcon, LinkSlashIcon } from "@heroicons/react/16/solid";
import {} from "@heroicons/react/20/solid";
import { useBackupListQueryClient } from "@lib/providers/backup-list-query-client";
import { useMongoDatabaseListQueryClient } from "@lib/providers/mongo-database-list-query-client";
import { cn, humanReadableEnumString, shortHumanizeDuration, timeAgoString } from "@lib/utils";
import { DotsVerticalIcon, DownloadIcon } from "@radix-ui/react-icons";
import { useMutation } from "@tanstack/react-query";
import prettyBytes from "pretty-bytes"
import { useState } from "react";
import { Badge } from "@comp/badge";
import { AlertDialogDescription } from "@radix-ui/react-alert-dialog";
import Link from "next/link";
import { useLoadingToastCleaner } from "@lib/use-toast-cleaner";
import { Statbox } from "./statbox";
import humanizeDuration from "humanize-duration";
import { useBackupPoliciesListQueryClient } from "@lib/providers/backup-policies-list-query-client";

function Badges({
  backup,
  className
}: {
  backup: BackupWithRelations,
  className?: string
}) {
  return (
    <div className={cn(["flex flex-row gap-2", className])}>
      {!backup.backupPolicyId && (
        <Badge variant={"secondary"} className="size-fit">
          <CursorArrowRaysIcon className="w-4 h-4 mr-1 -ml-1" />
          Created Manually
        </Badge>
      )}
      {backup.backupPolicyId && (
        <Badge variant={"secondary"} className="size-fit">
          <SparklesIcon className="w-4 h-4 mr-1 -ml-1" />
          Created by Policy 
        </Badge>
      )}
      {backup.backupPolicyId && backup.backupPolicy && (
        <>
          <Badge variant={"secondary"} className="size-fit">
            <LinkIcon className="w-4 h-4 mr-1 -ml-1" />
            {backup.backupPolicy.referenceName}
          </Badge>
          <Badge variant={"destructive"} className="size-fit">
            <TrashIcon className="w-4 h-4 mr-1 -ml-1" />
            {shortHumanizeDuration((backup.finishedAt.getTime() + backup.backupPolicy.backupRetentionDays * 86400000) - Date.now())}
          </Badge>
          </>
      )}
      {backup.backupPolicyId && !backup.backupPolicy && (
        <Badge variant={"destructive"} className="size-fit">
          <LinkSlashIcon className="w-4 h-4 mr-1 -ml-1" />
          Associated Policy Deleted
        </Badge>
      )}
      {backup.mongoDatabaseId && backup.mongoDatabase && (
        <Badge variant={"secondary"} className="size-fit">
          <LinkIcon className="w-4 h-4 mr-1 -ml-1" />
          {backup.mongoDatabase.referenceName}
        </Badge>
      )}
      {backup.mongoDatabaseId && !backup.mongoDatabase && (
        <Badge variant={"destructive"} className="size-fit">
          <LinkSlashIcon className="w-4 h-4 mr-1 -ml-1" />
          Associated Database Removed
        </Badge>
      )}

    </div>
  );
}

export function BackupCard({
  backup,
}: {
  backup: BackupWithRelations,
}) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const backupListQueryClient = useBackupListQueryClient(); 
  const mongoDatabaseListQueryClient = useMongoDatabaseListQueryClient();
  const backupPoliciesListQueryClient = useBackupPoliciesListQueryClient();
  const loadingToastRef = useLoadingToastCleaner();

  const deleteBackupMutation = useMutation({
    mutationFn: async () => await deleteBackup(backup.id),
    onSuccess: (result) => {

      toastForActionResult(result);

      if(!result?.success) return;

      backupListQueryClient.notifyBackupWasDeleted(backup.id);
      mongoDatabaseListQueryClient.notifyDatabasesPotentiallyDirty();
      backupPoliciesListQueryClient.notifyBackupPoliciesPotentiallyDirty();
    }
  });
  
  const msToComplete = backup.finishedAt.getTime() - backup.startedAt.getTime();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-row flex-grow gap-2">
        <div className="flex flex-col gap-2 w-full">
          <div className="flex flex-row gap-2 place-items-center w-full">
            <div className="flex flex-row gap-2 place-items-center w-full">
              <h1 className="text-lg font-semibold capitalize">{timeAgoString(backup.finishedAt)}</h1>
              <Badges className="hidden lg:inline-flex" backup={backup} />
              <p className="grow text-sm text-muted-foreground text-right">{backup.finishedAt.toLocaleString(undefined, {dateStyle: "medium", timeStyle: "short"})}</p>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant={"ghost"} size="icon">
                    <DotsVerticalIcon className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem asChild>
                    <Link href={`/api/download/${backup.id}`}>
                      <DownloadIcon className="w-4 h-4 mr-2" />
                      Download
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="bg-destructive/75 focus:bg-destructive text-destructive-foreground" onClick={() => setDeleteDialogOpen(true)} disabled={deleteBackupMutation.isPending}>
                      <TrashIcon className="w-4 h-4 mr-2" />
                      Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertGenericConfirmationDialogContent 
                  destructive
                  onConfirm={() => {
                    loadingToastRef.current = toast.loading("Deleting backup...");
                    deleteBackupMutation.mutate(undefined, {
                      onSettled: () => {
                        toast.dismiss(loadingToastRef.current);
                      }
                    });
                  }}
                >
                  <AlertDialogDescription>
                    Are you sure you want to delete this backup?
                  </AlertDialogDescription>
                </AlertGenericConfirmationDialogContent>
              </AlertDialog>
            </div>
          </div>
          <Badges className="inline-flex flex-wrap lg:hidden" backup={backup} />
          <div className="w-full gap-4 grid grid-cols-2 lg:grid-cols-3 py-4">
            <Statbox className="col-span-1" title="Database Name" stat={backup.sourceMetadata.databaseName} Icon={Square3Stack3DIcon} />
            <Statbox className="col-span-1" title="Documents" stat={backup.sourceMetadata.collections.reduce((acc, c) => acc + c.documentCount, 0).toLocaleString()} Icon={DocumentIcon} />
            <Statbox className="col-span-1" title="Collections" stat={backup.sourceMetadata.collections.length.toLocaleString()} Icon={TableCellsIcon} />
            <Statbox className="col-span-1" title="Completed In" stat={humanizeDuration(msToComplete)} Icon={ClockIcon} />
            <Statbox className="col-span-1 capitalize" title="Mode" stat={humanReadableEnumString(backup.mode)} Icon={CogIcon} />
            <Statbox className="col-span-1" title="Size" stat={`${prettyBytes(backup.sizeBytes)}`} Icon={ChartPieIcon} />
            {/* <Statbox className="col-span-1" title="Trigger" stat={backup.backupPolicy ? "Backup Policy" : "Manual"} Icon={CogIcon} /> */}
            {/* <Statbox className="col-span-1" title="Backup Rate" stat={} Icon={ChartPieIcon} /> */}
          </div>
        </div>
      </div>
    </div>
  );
}