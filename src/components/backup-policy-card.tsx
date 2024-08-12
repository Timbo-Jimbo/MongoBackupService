import { Button } from "@comp/button";
import { AdjustmentsHorizontalIcon, ArchiveBoxXMarkIcon, ArrowLeftCircleIcon, ArrowLeftIcon, ArrowRightIcon, ArrowUturnLeftIcon, BackwardIcon, CalendarDaysIcon, CalendarIcon, ChartPieIcon, ForwardIcon, PencilIcon, PencilSquareIcon, ScaleIcon, Square3Stack3DIcon, TrashIcon, XCircleIcon } from "@heroicons/react/20/solid";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { DotsVerticalIcon } from "@radix-ui/react-icons";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@comp/dropdown-menu";
import { AlertDialog, AlertDialogDescription, AlertGenericConfirmationDialogContent } from "@comp/alert-dialog";
import { BackupPolicy, BackupPolicyWithRelations, InsertBackupPolicy } from "@backend/db/backup-policy.schema";
import { useBackupPoliciesListQueryClient } from "@lib/providers/backup-policies-list-query-client";
import { deleteBackupPolicy, updateBackupPolicy } from "@actions/backup-policies";
import { toast, toastForActionResult } from "@comp/toasts";
import cronstrue from "cronstrue";
import { useLoadingToastCleaner } from "@lib/use-toast-cleaner";
import { cn, humanReadableEnumString, timeAgoString, timeUntilString } from "@lib/utils";
import { Task } from "@backend/db/task.schema";
import { Badge } from "@comp/badge";
import { LoadingSpinner } from "@comp/loading-spinner";
import { tryUseMongoDatabaseListQueryClient } from "@lib/providers/mongo-database-list-query-client";
import { tryUseTaskListQueryClient } from "@lib/providers/task-list-query-client";
import { tryUseBackupListQueryClient, useBackupListQueryClient } from "@lib/providers/backup-list-query-client";
import { MiniStatbox, Statbox } from "./statbox";
import prettyBytes from "pretty-bytes";
import { DialogBackupPolicy } from "./dialog-backup-policy";
import { BackupMode } from "@backend/tasks/compression.enums";
import { CogIcon } from "@heroicons/react/16/solid";

function Badges({
  backupPolicy,
  className
}: {
  backupPolicy: BackupPolicyWithRelations,
  className?: string
}) {
  return (
    <div className={cn(["flex flex-row gap-2 size-fit", className])}>
      {backupPolicy.activeTask && !backupPolicy.activeTask.isComplete && (
        <Badge variant={"outline"} className="flex-grow justify-center animate-pulse">
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
  const [updateBackupPolicyDialogOpen, setUpdateBackupPolicyDialogOpen] = useState(false);

  //hack to detect backup policy transitioning into running state..!
  const taskListQueryClient = tryUseTaskListQueryClient();
  const backupListQueryClient = useBackupListQueryClient();
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

  const updateBackupPolicyMutation = useMutation({
    mutationFn: async (values: InsertBackupPolicy) => {
      return await updateBackupPolicy(backupPolicy.id, values);
    },
    onSuccess: async (result) => {
      toastForActionResult(result);
      if(!result?.success) return;
      backupPoliciesListQueryClient.notifyBackupPolicyWasModified(result.backupPolicy);
      backupListQueryClient.notifyBackupsPotentiallyDirty();
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
                <DropdownMenuItem onClick={() => setUpdateBackupPolicyDialogOpen(true)}>
                  <PencilSquareIcon className="w-4 h-4 mr-2" />
                  Update
                </DropdownMenuItem>
                <DropdownMenuSeparator/>
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
          <Statbox className="col-span-1" title="Next Run" Icon={ArrowRightIcon}>
            {backupPolicy.activeTask && !backupPolicy.activeTask.isComplete && "Running now"}
            {(!backupPolicy.activeTask || backupPolicy.activeTask.isComplete) && (
              backupPolicy.nextBackupAt ? timeUntilString(backupPolicy.nextBackupAt) : "Never"  
            )}
          </Statbox>
          <Statbox className="col-span-1 capitalize" title="Mode" Icon={CogIcon}>{humanReadableEnumString(backupPolicy.backupMode)}</Statbox>
          <Statbox className="col-span-1" title="Last Run" Icon={ArrowUturnLeftIcon}>{backupPolicy.lastBackupAt ? timeAgoString(backupPolicy.lastBackupAt) : "Never"}</Statbox>
          <Statbox className="col-span-1" title="Retention" Icon={CalendarDaysIcon}>{`${backupPolicy.backupRetentionDays} days`}</Statbox>
          <Statbox className="col-span-1" title="Backups" Icon={Square3Stack3DIcon}>{backupPolicy.backups.length.toLocaleString()}</Statbox>
          <Statbox className="col-span-1" title="Total Size" Icon={ChartPieIcon}>{prettyBytes(backupPolicy.backups.reduce((sumBytes, backup) => { return sumBytes + backup.sizeBytes; }, 0))}</Statbox>
          </div>
        </div>
      </div>

      <DialogBackupPolicy
        defaults={{
          referenceName: backupPolicy.referenceName,
          cronExpression: backupPolicy.backupIntervalCron,
          retentionDays: backupPolicy.backupRetentionDays,
          mode: backupPolicy.backupMode
        }}
        supportedOptions={backupListQueryClient.availableBackupModesQuery?.data ?? []}
        actionName="Update Policy"
        open={updateBackupPolicyDialogOpen}
        onOpenChange={setUpdateBackupPolicyDialogOpen}
        onActionClick={(referenceName: string, cronExpression: string, retentionDays: number, mode: BackupMode) => {
          setUpdateBackupPolicyDialogOpen(false);
          const toastId = toast.loading("Updating backup policy...");
          updateBackupPolicyMutation.mutate({
            mongoDatabaseId: backupPolicy.mongoDatabaseId,
            referenceName: referenceName,
            backupIntervalCron: cronExpression,
            backupRetentionDays: retentionDays,
            backupMode: mode
          }, {
            onSettled: () => {
              toast.dismiss(toastId);
            }
          });
        }}
      />
    </div>
  );
}