import { deleteBackup } from "@actions/backups";
import { Backup } from "@backend/db/backup.schema";
import { AlertDialog, AlertGenericConfirmationDialogContent } from "@comp/alert-dialog";
import { Button } from "@comp/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@comp/dropdown-menu";
import { toast, toastForActionResult } from "@comp/toasts";
import { ChartPieIcon, DocumentIcon, Square3Stack3DIcon, TableCellsIcon } from "@heroicons/react/20/solid";
import { useBackupListQueryClient } from "@lib/providers/backup-list-query-client";
import { timeAgoString } from "@lib/utils";
import { DotsVerticalIcon, TrashIcon } from "@radix-ui/react-icons";
import { useMutation } from "@tanstack/react-query";
import prettyBytes from "pretty-bytes"
import { useState } from "react";

interface TitleAndStatPassInIconProps {
  Icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  title: string;
  stat: string;
}

const TitleAndStat: React.FC<TitleAndStatPassInIconProps> = ({
  title,
  stat,
  Icon
}) => {
  return (
    <div className="flex flex-row place-items-center">
      {Icon && <Icon className="w-10 h-10 mr-3" />}
      <div className="flex flex-col gap-0">
        <span className="opacity-50 text-xs">{title}</span>
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

  const deleteBackupMutation = useMutation({
    mutationFn: async () => await deleteBackup(backup.id),
    onSuccess: (result) => {

      toastForActionResult(result);

      if(!result?.success) return;

      backupListQueryClient.notifyBackupWasDeleted(backup.id);
    }
  });
  
  return (
    <div className="flex flex-col my-4 gap-4">
      <div className="flex flex-row flex-grow gap-2">
        <div className="flex flex-col gap-2 w-full">
          <div className="flex flex-row gap-2 place-items-center w-full">
            <div className="flex flex-row gap-2 place-items-center w-full">
              <h1 className="text-lg font-semibold capitalize">{timeAgoString(backup.createdAt)}</h1>
              <p className="grow text-sm opacity-50 text-right">{backup.createdAt.toLocaleString(undefined, {dateStyle: "medium", timeStyle: "short"})}</p>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant={"ghost"} size="icon">
                    <DotsVerticalIcon className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem className="bg-destructive text-destructive-foreground" onClick={() => setDeleteDialogOpen(true)} disabled={deleteBackupMutation.isPending}>
                      <TrashIcon className="w-4 h-4 mr-2" />
                      Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertGenericConfirmationDialogContent 
                  body="Are you sure you want to delete this backup?"
                  onConfirm={() => {
                    const toastId = toast.loading("Deleting backup...");
                    deleteBackupMutation.mutate(undefined, {
                      onSettled: () => {
                        toast.dismiss(toastId);
                      }
                    });
                  }}
                />
              </AlertDialog>
            </div>
          </div>
          <div className="flex flex-row gap-2 place-items-center my-4">
            <div className="flex flex-row w-full place-content-between ">
              <TitleAndStat title="Database Name" stat={backup.sourceMetadata.databaseName} Icon={Square3Stack3DIcon} />
              <TitleAndStat title="Documents" stat={backup.sourceMetadata.collections.reduce((acc, c) => acc + c.documentCount, 0).toLocaleString()} Icon={DocumentIcon} />
              <TitleAndStat title="Collections" stat={backup.sourceMetadata.collections.length.toLocaleString()} Icon={TableCellsIcon} />
              <TitleAndStat title="Size" stat={prettyBytes(backup.sizeBytes)} Icon={ChartPieIcon} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}