import { Button } from "@comp/button";
import { AdjustmentsHorizontalIcon, ArchiveBoxXMarkIcon, ArrowLeftCircleIcon, ArrowLeftIcon, ArrowRightIcon, ArrowUturnLeftIcon, BackwardIcon, CalendarDaysIcon, CalendarIcon, ChartPieIcon, ForwardIcon, ScaleIcon, Square3Stack3DIcon, TrashIcon, XCircleIcon } from "@heroicons/react/20/solid";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { DotsVerticalIcon } from "@radix-ui/react-icons";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@comp/dropdown-menu";
import { AlertDialog, AlertDialogDescription, AlertGenericConfirmationDialogContent } from "@comp/alert-dialog";
import { BackupPolicy, BackupPolicyWithRelations } from "@backend/db/backup-policy.schema";
import { useBackupPoliciesListQueryClient } from "@lib/providers/backup-policies-list-query-client";
import { deleteBackupPolicy } from "@actions/backup-policies";
import { toast, toastForActionResult } from "@comp/toasts";
import cronstrue from "cronstrue";
import { useLoadingToastCleaner } from "@lib/use-toast-cleaner";
import { cn, humanReadableEnumString, timeAgoString, timeUntilString } from "@lib/utils";
import { Task } from "@backend/db/task.schema";
import { Badge } from "@comp/badge";
import { LoadingSpinner } from "@comp/loading-spinner";
import { tryUseMongoDatabaseListQueryClient } from "@lib/providers/mongo-database-list-query-client";
import { tryUseTaskListQueryClient } from "@lib/providers/task-list-query-client";
import { tryUseBackupListQueryClient } from "@lib/providers/backup-list-query-client";
import { MiniStatbox, Statbox } from "./statbox";
import prettyBytes from "pretty-bytes";

function Badges({
  backupPolicy,
  className
}: {
  backupPolicy: BackupPolicyWithRelations,
  className?: string
}) {
  return (
    <div className={cn(["flex flex-row gap-2", className])}>
      {backupPolicy.activeTask && !backupPolicy.activeTask.isComplete && (
        <Badge variant={"outline"} className="animate-pulse">
            <LoadingSpinner className="w-4 h-4 mr-1 -ml-1" />
            Running
        </Badge>
      )}
    </div>
  )
}

export function BackupPolicyCard({
  index,
  backupPolicy,
}: {
  index: number
  backupPolicy: BackupPolicyWithRelations
}) {
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const backupPoliciesListQueryClient = useBackupPoliciesListQueryClient();
  const loadingToastRef = useLoadingToastCleaner();

  //hack to detect backup policy transitioning into running state..!
  const taskListQueryClient = tryUseTaskListQueryClient();
  const backupListQueryClient = tryUseBackupListQueryClient();
  const mongoDatabaseListQueryClient = tryUseMongoDatabaseListQueryClient();

  const activeTaskIdRef = useRef(backupPolicy.activeTask?.id);

  useEffect(() => {
    if(activeTaskIdRef.current === backupPolicy.activeTask?.id) return;
      
      taskListQueryClient?.notifyTasksPotentiallyDirty();
      backupListQueryClient?.notifyBackupsPotentiallyDirty();
      mongoDatabaseListQueryClient?.notifyDatabasesPotentiallyDirty();
      activeTaskIdRef.current = backupPolicy.activeTask?.id;

  }, [backupPolicy.activeTask?.id]);

  //end hack

  const deleteBackupPolicyMutation = useMutation({
    mutationFn: async (deleteBackups: boolean) => await deleteBackupPolicy(backupPolicy.id, deleteBackups),
    onSuccess: (result) => {
      toastForActionResult(result);
      if(!result?.success) return;
      backupPoliciesListQueryClient.notifyBackupPolicyWasDeleted(backupPolicy.id);
    }
  });

  const cronString = cronstrue.toString(backupPolicy.backupIntervalCron);
  const decapitilizedCronString = cronString.charAt(0).toLowerCase() + cronString.slice(1);
  return (
    <div className="flex flex-row flex-grow gap-2 px-4 py-2 rounded-xl">
      <div className="flex flex-row gap-2 w-full">
        <div className="flex">
          <span className="text-lg font-semibold mr-2 mt-3 rounded-full border-[2px] border-muted size-8 text-center place-content-center">{index + 1}</span>
        </div>
        <div className="flex flex-col gap-2 place-items-center w-full">
          <div className="flex flex-row gap-2 place-items-center w-full">
            <div className="flex flex-col w-full">
              <div className="flex flex-row place-items-center gap-2"> 
                <h1 className="font-semibold text-lg capitalize">{backupPolicy.referenceName}</h1>
                <Badges backupPolicy={backupPolicy} />
              </div>
              <p className="text-sm text-muted-foreground">Runs {decapitilizedCronString}</p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant={"ghost"} size="icon">
                  <DotsVerticalIcon className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem className="bg-destructive/75 focus:bg-destructive text-destructive-foreground" onClick={() => setDeleteDialogOpen(true)} disabled={deleteBackupPolicyMutation.isPending}>
                    <TrashIcon className="w-4 h-4 mr-2" />
                    Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <AlertGenericConfirmationDialogContent
                destructive
                onConfirm={() => {
                  loadingToastRef.current = toast.loading("Deleting backup policy...");
                  deleteBackupPolicyMutation.mutate(false, {
                    onSettled: () => {
                      toast.dismiss(loadingToastRef.current);
                    }
                  });
                  setDeleteDialogOpen(false);
               }}
              >
                <AlertDialogDescription>
                  Are you sure you want to delete this backup?
                </AlertDialogDescription>
              </AlertGenericConfirmationDialogContent>
            </AlertDialog>
          </div>
          <div className="w-full gap-4 grid grid-cols-2 lg:grid-cols-3 py-4">
          <Statbox className="col-span-1" title="Next Run" stat={(backupPolicy.activeTask && !backupPolicy.activeTask.isComplete) ? "Running right now" : backupPolicy.nextBackupAt ? timeUntilString(backupPolicy.nextBackupAt) : "Never"} Icon={ArrowRightIcon} />
          <Statbox className="col-span-1 capitalize" title="Mode" stat={humanReadableEnumString(backupPolicy.backupMode)} Icon={AdjustmentsHorizontalIcon} />
          <Statbox className="col-span-1" title="Last Run" stat={backupPolicy.lastBackupAt ? timeAgoString(backupPolicy.lastBackupAt) : "Never"} Icon={ArrowUturnLeftIcon} />
          <Statbox className="col-span-1" title="Retention" stat={`${backupPolicy.backupRetentionDays} days`} Icon={CalendarDaysIcon} />
          <Statbox className="col-span-1" title="Backups" stat={backupPolicy.backups.length.toLocaleString()} Icon={Square3Stack3DIcon} />
          <Statbox className="col-span-1" title="Total Size" stat={prettyBytes(backupPolicy.backups.reduce((sumBytes, backup) => { return sumBytes + backup.sizeBytes; }, 0))} Icon={ChartPieIcon} />
          </div>
        </div>
      </div>
    </div>
  );
}