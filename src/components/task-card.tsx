import { deleteTask, updateTask } from "@actions/tasks";
import { Task, TaskCancellationType, TaskState } from "@backend/db/task.schema";
import { Badge } from "@comp/badge";
import { Button } from "@comp/button";
import { LoadingSpinner } from "@comp/loading-spinner";
import { Progress, ProgressUncertain } from "@comp/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@comp/tooltip";
import { CheckCircleIcon, ClockIcon, ExclamationCircleIcon, ExclamationTriangleIcon, XCircleIcon } from "@heroicons/react/20/solid";
import { useMutation } from "@tanstack/react-query";
import { Fragment, useEffect, useRef, useState } from "react";
import { AnimatedNumber } from "./animated-number";
import { useTaskListQueryClient } from "@lib/providers/task-list-query-client";
import { tryUseMongoDatabaseListQueryClient } from "@lib/providers/mongo-database-list-query-client";
import { tryUseBackupListQueryClient } from "@lib/providers/backup-list-query-client";
import { DurationDisplay } from "./time-since-display";
import { Cross2Icon, DotsVerticalIcon } from "@radix-ui/react-icons";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@comp/dropdown-menu";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@comp/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@comp/alert";
import { cn, humanReadableEnumString } from "@lib/utils";
import { tryUseBackupPoliciesListQueryClient, useBackupPoliciesListQueryClient } from "@lib/providers/backup-policies-list-query-client";

function Badges({
  task,
  className
}: {
  task: Task,
  className?: string
}) {
  return (
    <div className={cn(["flex flex-row gap-2 size-fit", className])}>
      {!task.isComplete && (
        <Badge variant={"outline"} className="animate-pulse" >
          Running
        </Badge>
      )}
      {task.isComplete && (
        <Badge variant={task.state == TaskState.Completed ? "positive" : "destructive"} className="capitalize">
          {task.state === TaskState.Cancelled && <XCircleIcon className="w-4 h-4 mr-1 -ml-1" /> }
          {task.state === TaskState.Failed && <ExclamationCircleIcon className="w-4 h-4 mr-1 -ml-1" /> }
          {task.state === TaskState.Completed && <CheckCircleIcon className="w-4 h-4 mr-1 -ml-1" /> }
          {humanReadableEnumString(task.state)}
        </Badge>
      )}
      <Badge variant={"secondary"}>
        <ClockIcon className="w-4 h-4 mr-1 -ml-1" />
        <DurationDisplay startTime={task.startedAt} endTime={() => task.completedAt ?? new Date()} />
      </Badge>
    </div>
  );
}

export function TaskCard({
  task,
}: {
  task: Task,
}) {
  
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const cancellingTask = useRef(task.cancelRequested);
  const taskListQueryClient = useTaskListQueryClient();
  const mongoDatabaseListQueryClient = tryUseMongoDatabaseListQueryClient();
  const backupListQueryClient = tryUseBackupListQueryClient();
  const backupPolicyListQueryClient = tryUseBackupPoliciesListQueryClient();

  //hack to detect task transitioning into complete state..!

  const taskStateRef = useRef(task.state);

  useEffect(() => {
    if(taskStateRef.current === task.state) return;

    if(task.state !== TaskState.Running)
    {
      mongoDatabaseListQueryClient?.notifyDatabasesPotentiallyDirty();
      backupPolicyListQueryClient?.notifyBackupPoliciesPotentiallyDirty();
      backupListQueryClient?.notifyBackupsPotentiallyDirty();
    }

    taskStateRef.current = task.state;
  }, [task.state]);

  //end hack

  const deleteTaskMutation = useMutation({
    mutationFn: async () => await deleteTask(task.id),
    onSuccess: (result) => {

      if(!result?.success) return;

      taskListQueryClient.notifyTaskWasDeleted(task.id);
    }
  });
  
  const cancelTaskMutation = useMutation({
    mutationFn: async () => {
      cancellingTask.current = true;
      return await updateTask({ id: task.id, update: { cancelRequested: true } });
    },
    onSuccess: (updatedTask) => {
      if(!updatedTask) 
      {
        cancellingTask.current = false;
        return;
      }
      
      taskListQueryClient.notifyTaskWasModified(updatedTask);
    },
    onError: () => {
      cancellingTask.current = false;
    }
  });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-row flex-grow gap-2">
        <div className="flex flex-col gap-2 w-full">
          <div className="flex flex-row gap-2 place-items-center w-full">
            <div className="flex flex-row gap-2 place-items-center w-full">
              <h1 className="text-lg font-semibold capitalize">{humanReadableEnumString(task.type)}</h1>
              <Badges className="hidden lg:inline-flex" task={task} />
              <p className="grow text-sm text-muted-foreground text-right">{task.startedAt.toLocaleString(undefined, {dateStyle: "medium", timeStyle: "short"})}</p>
              {!task.isComplete && (
                <>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant={"ghost"} size="icon">
                        <DotsVerticalIcon className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <Tooltip delayDuration={0} open={(task.cancellationType != TaskCancellationType.NotCancellable) ? false : undefined}>
                      <DropdownMenuContent>
                        <TooltipTrigger className="w-full">
                          <DropdownMenuItem onClick={() => setCancelDialogOpen(true)} disabled={cancellingTask.current || task.cancellationType == TaskCancellationType.NotCancellable}>
                            {cancellingTask.current && <LoadingSpinner className="w-4 h-4 mr-2" />}
                            {!cancellingTask.current && (task.cancellationType == TaskCancellationType.DangerousToCancel ? <ExclamationTriangleIcon className="w-4 h-4 mr-2" /> : <Cross2Icon className="w-4 h-4 mr-2" />)}
                            Cancel
                          </DropdownMenuItem>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>The task can not be cancelled at this point.</p>
                        </TooltipContent>
                      </DropdownMenuContent>
                    </Tooltip>
                  </DropdownMenu>
                  <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirmation</AlertDialogTitle>
                      </AlertDialogHeader>
                      <AlertDialogDescription className="flex flex-col gap-3">
                        Are you sure you want to cancel this task?
                        {task.cancellationType == TaskCancellationType.DangerousToCancel && (
                          <Alert variant="destructive">
                            <ExclamationTriangleIcon className="h-4 w-4" />
                            <AlertTitle>This task is not safe to cancel</AlertTitle>
                            <AlertDescription>
                            Cancelling this task now may lead to loss of data. 
                            </AlertDescription>
                          </Alert>
                        )}
                      </AlertDialogDescription>
                      <AlertDialogFooter>
                        <AlertDialogAction 
                          destructive={task.cancellationType == TaskCancellationType.DangerousToCancel}
                          onClick={() => {
                            const toastId = toast.loading("Cancelling task...");
                            cancelTaskMutation.mutate(undefined, {
                              onSettled: () => {
                                toast.dismiss(toastId);
                              }
                            });
                          }}
                        >
                          {task.cancellationType == TaskCancellationType.DangerousToCancel ? "Confirm (I know what I am doing)" : "Confirm"}
                        </AlertDialogAction>
                        <AlertDialogCancel>
                          Cancel
                        </AlertDialogCancel>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
              {task.isComplete && (
                <Button variant={"ghost"} size="icon" onClick={() => deleteTaskMutation.mutate()} disabled={deleteTaskMutation.isPending}>
                  {deleteTaskMutation.isPending ? <LoadingSpinner className="w-4 h-4" /> : <Cross2Icon className="w-4 h-4" />}
                </Button>
              )}
            </div>
          </div>
          <Badges className="inline-flex lg:hidden" task={task} />
          <div className="flex flex-row gap-2 place-items-center">
            {!task.isComplete && <LoadingSpinner className="w-7 h-7 mr-2" />}
            <div className="flex flex-col w-full gap-1">
              {task.progress && <p className={(task.progress.hasProgressValues ? "text-sm" : "")}>{task.progress.message}</p>}
              {!task.isComplete && task.progress?.hasProgressValues && (
                <div className="text-sm">
                  <AnimatedNumber endValue={task.progress.current} lerpFactor={0.01} />
                  <span className="text-muted-foreground"> of {task.progress.total.toLocaleString()} {task.progress.countedThingName}</span>
                </div>
              )}
            </div>
          </div>
          { !task.isComplete && task.progress?.hasProgressValues && (
            <div className="flex flex-row flex-grow w-full mt-2" key={"progress"}>
              <Progress className="w-full duration-1000" value={(task.progress.current/task.progress.total) * 100} />
            </div>
          )}
          {!task.isComplete && !task.progress?.hasProgressValues && (
            <div className="flex flex-row flex-grow w-full mt-2" key={"progress"}>
              <ProgressUncertain className="w-full"/>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}