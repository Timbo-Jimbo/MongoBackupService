import { Button } from "@comp/button";
import { TrashIcon } from "@heroicons/react/20/solid";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { DotsVerticalIcon } from "@radix-ui/react-icons";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@comp/dropdown-menu";
import { AlertDialog, AlertDialogDescription, AlertGenericConfirmationDialogContent } from "@comp/alert-dialog";
import { BackupPolicy, BackupPolicyWithActiveTask } from "@backend/db/backup-policy.schema";
import { useBackupPoliciesListQueryClient } from "@lib/providers/backup-policies-list-query-client";
import { deleteBackupPolicy } from "@actions/backup-policies";
import { toast, toastForActionResult } from "@comp/toasts";
import cronstrue from "cronstrue";
import { useLoadingToastCleaner } from "@lib/use-toast-cleaner";
import { cn, timeUntilString } from "@lib/utils";
import { Task } from "@backend/db/task.schema";
import { Badge } from "@comp/badge";
import { LoadingSpinner } from "@comp/loading-spinner";
import { tryUseMongoDatabaseListQueryClient } from "@lib/providers/mongo-database-list-query-client";
import { tryUseTaskListQueryClient } from "@lib/providers/task-list-query-client";
import { tryUseBackupListQueryClient } from "@lib/providers/backup-list-query-client";

function Badges({
  activeTask,
  className
}: {
  activeTask: Task | null,
  className?: string
}) {
  return (
    <>
      {activeTask && !activeTask.isComplete && (
      <div className={cn(["flex flex-row gap-2", className])}>
        <Badge variant={"outline"} className="animate-pulse">
            <LoadingSpinner className="w-4 h-4 mr-2" />
            Running
        </Badge>
      </div>
      )}
    </>
  )
}


export function BackupPolicyCard({
  index,
  backupPolicy,
}: {
  index: number
  backupPolicy: BackupPolicyWithActiveTask
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

  return (
    <div className="flex flex-row flex-grow gap-2">
      <div className="flex flex-col gap-2 w-full">
        <div className="flex flex-row gap-2 place-items-center w-full">
          <div className="flex flex-row gap-2 place-items-center w-full">
            <div className="flex">
              <span className="text-sm font-semibold mr-1 rounded-full border-[2px] border-muted/40 size-6 text-center place-content-center text-muted-foreground">{index + 1}</span>
            </div>
            <div className="flex flex-col w-full gap-2">
              <div className="flex flex-col w-full"> 
                <h1 className="font-normal capitalize w-full">{cronString}</h1>
                {!backupPolicy.lastBackupAt && <p className="text-sm text-muted-foreground">Has never run</p>}
                {backupPolicy.lastBackupAt && <p className="text-sm text-muted-foreground">Last backup at {backupPolicy.lastBackupAt.toLocaleString(undefined, {dateStyle: "medium", timeStyle: "short"})}</p>}
              </div>
              <Badges activeTask={backupPolicy.activeTask} />
              {(!backupPolicy.activeTask || backupPolicy.activeTask.isComplete) && (
                <div className="flex flex-row w-full text-sm">
                  {backupPolicy.nextBackupAt && (
                    <>
                      Next backup in {timeUntilString(backupPolicy.nextBackupAt)}
                    </>
                  )}
                  {!backupPolicy.nextBackupAt && <p>This policy is not scheduled to run ever again.</p>}
                </div>
              )}
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
        </div>
      </div>
    </div>
  );
}