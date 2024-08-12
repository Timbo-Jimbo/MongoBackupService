import { deleteBackup } from "@actions/backups";
import { Backup } from "@backend/db/backup.schema";
import { AlertDialog, AlertGenericConfirmationDialogContent } from "@comp/alert-dialog";
import { Button } from "@comp/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@comp/dropdown-menu";
import { toast, toastForActionResult } from "@comp/toasts";
import { ChartPieIcon, ClockIcon, DocumentIcon, Square3Stack3DIcon, TableCellsIcon, TrashIcon } from "@heroicons/react/20/solid";
import { useBackupListQueryClient } from "@lib/providers/backup-list-query-client";
import { useMongoDatabaseListQueryClient } from "@lib/providers/mongo-database-list-query-client";
import { cn, humanReadableEnumString, timeAgoString } from "@lib/utils";
import { DotsVerticalIcon, DownloadIcon } from "@radix-ui/react-icons";
import { useMutation } from "@tanstack/react-query";
import prettyBytes from "pretty-bytes"
import { useState } from "react";
import { DurationDisplay } from "./time-since-display";
import { Badge } from "@comp/badge";
import { AlertDialogDescription } from "@radix-ui/react-alert-dialog";
import Link from "next/link";
import { useLoadingToastCleaner } from "@lib/use-toast-cleaner";

function Badges({
  backup,
  className
}: {
  backup: Backup,
  className?: string
}) {
  return (
    <div className={cn(["flex flex-row gap-2 size-fit", className])}>
      <Badge variant={"secondary"}>
        <ClockIcon className="w-4 h-4 mr-1 -ml-1" />
        <DurationDisplay startTime={backup.startedAt} endTime={backup.finishedAt} />
      </Badge>
      <Badge variant={"secondary"} className="capitalize">
      <span className="opacity-50 mr-1">Mode</span>{humanReadableEnumString(backup.mode)}
      </Badge>
    </div>
  );
}

interface TitleAndStatPassInIconProps {
  Icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  title: string;
  stat: string;
  className?: string;
}

const TitleAndStat: React.FC<TitleAndStatPassInIconProps> = ({
  title,
  stat,
  Icon,
  className
}) => {
  return (
    <div className={cn(["flex flex-row shrink-0", className])}>
      {Icon && <Icon className="w-10 h-10 mr-3" />}
      <div className="flex flex-col gap-0">
        <span className="text-muted-foreground text-xs">{title}</span>
        {stat} 
      </div>
    </div>
  );
}

export function BackupCard({
  backup,
}: {
  backup: Backup,
}) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const backupListQueryClient = useBackupListQueryClient(); 
  const mongoDatabaseListQueryClient = useMongoDatabaseListQueryClient();
  const loadingToastRef = useLoadingToastCleaner();

  const deleteBackupMutation = useMutation({
    mutationFn: async () => await deleteBackup(backup.id),
    onSuccess: (result) => {

      toastForActionResult(result);

      if(!result?.success) return;

      backupListQueryClient.notifyBackupWasDeleted(backup.id);
      mongoDatabaseListQueryClient.notifyDatabasesPotentiallyDirty();
    }
  });
  
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
          <Badges className="inline-flex lg:hidden" backup={backup} />
          <div className="w-full gap-4 py-4 grid grid-cols-2 lg:flex lg:flex-row lg:place-content-between">
            <TitleAndStat title="Database Name" stat={backup.sourceMetadata.databaseName} Icon={Square3Stack3DIcon} />
            <TitleAndStat title="Documents" stat={backup.sourceMetadata.collections.reduce((acc, c) => acc + c.documentCount, 0).toLocaleString()} Icon={DocumentIcon} />
            <TitleAndStat title="Collections" stat={backup.sourceMetadata.collections.length.toLocaleString()} Icon={TableCellsIcon} />
            <TitleAndStat title="Size" stat={prettyBytes(backup.sizeBytes)} Icon={ChartPieIcon} />
          </div>
        </div>
      </div>
    </div>
  );
}