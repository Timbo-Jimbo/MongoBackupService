import { deleteTask, updateTask } from "@actions/tasks";
import { Task } from "@backend/db/task.schema";
import { Badge } from "@comp/badge";
import { ButtonWithSpinner } from "@comp/button";
import { LoadingSpinner } from "@comp/loading-spinner";
import { Progress, ProgressUncertain } from "@comp/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@comp/tooltip";
import { ClockIcon } from "@heroicons/react/20/solid";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import humanizeDuration from "humanize-duration";
import { useEffect, useRef } from "react";
import { AnimatedNumber } from "./animated-number";

export function TaskCard({
  task,
}: {
  task: Task,
}) {

  const queryClient = useQueryClient();

  //hacks! 
  //this is a little hacky, but im not sure what the best way to do this is yet
  //when we detect a task transitions to completed, we invalidate backups/mongo-db 
  //queries so they fetch. This job getting completed (probably) means one or both of those
  //have changes that need to be fetched..!
  const taskCompletedRef = useRef(task.isComplete);

  useEffect(() => {
    if(taskCompletedRef.current !== task.isComplete){
      taskCompletedRef.current = task.isComplete;

      queryClient.invalidateQueries({ queryKey: ["backups"] });
      queryClient.invalidateQueries({ queryKey: ["mongo-databases"] });
    };
  }, [task.isComplete]);

  //end hacks!

  const deleteTaskMutation = useMutation({
    mutationFn: async () => await deleteTask(task.id),
    onSuccess: (result) => {

      if(!result?.success) return;

      queryClient.setQueryData(["tasks"], (tasks: Task[]) => {
        return tasks.filter(t => t.id !== task.id);
      });
    }
  });
  
  const cancelTaskMutation = useMutation({
    mutationFn: async () => await updateTask({ id: task.id, update: { cancelRequested: true } }),
    onSuccess: (updatedTask) => {

      if(!updatedTask) return;

      queryClient.setQueryData(["tasks"], (tasks: Task[]) => {
        return tasks.map(t => {
          if(t.id === task.id) return updatedTask;
          return t;
        });
      });
    }
  });

  return (
    <div className="flex flex-col my-4 gap-4">
      <div className="flex flex-row flex-grow gap-2">
        <div className="flex flex-col gap-2 w-full">
          <div className="flex flex-row gap-2 place-items-center w-full">
            <div className="flex flex-row gap-2 place-items-center w-full">
              <h1 className="text-lg font-semibold capitalize">{task.type.toString().replace("_", " ")}</h1>
              <Badge variant={"secondary"} className="capitalize">
                <ClockIcon className="w-4 h-4 mr-2 -ml-1" /> {humanizeDuration((task.completedAt?.getTime() ?? Date.now()) - task.startedAt.getTime(), { round: true })}
              </Badge>
              {!task.isComplete && (
                <Badge variant={"outline"} className="animate-pulse" >
                  Pending
                </Badge>
              )}
              {task.isComplete && (
                <Badge variant={"secondary"} className="capitalize">
                  {task.state.toString().replace("_", " ")}
                </Badge>
              )}
              <p className="grow text-sm opacity-50 text-right">{task.startedAt.toLocaleString(undefined, {dateStyle: "medium", timeStyle: "short"})}</p>
            </div>
          </div>
          <div className="flex flex-row gap-2 place-items-center">
            {!task.isComplete && <LoadingSpinner className="w-5 h-5" />}
            <div className="flex flex-col gap-1 ">
              {task.progress && <p>{task.progress.message}</p>}
              {!task.isComplete && task.progress?.hasProgressValues && (
                <p className="text-sm">
                  <AnimatedNumber endValue={task.progress.current} lerpFactor={0.01} />
                  <span className="opacity-50 text-xs"> of {task.progress.total.toLocaleString()} {task.progress.countedThingName}</span>
                </p>
              )}
            </div>
            
            {(task.isComplete) && (
              <div className="flex flex-row flex-grow justify-end place-items-center">
                  <ButtonWithSpinner variant={"outline"} onClick={() => deleteTaskMutation.mutate()} isLoading={deleteTaskMutation.isPending}>
                    {deleteTaskMutation.isPending ? "Clearing..." : "Clear"}
                  </ButtonWithSpinner>
              </div>
            )}
            {!task.isComplete && task.canBeCancelled && (
              <div className="flex flex-row flex-grow justify-end place-items-center">
                  <ButtonWithSpinner onClick={() => cancelTaskMutation.mutate()} isLoading={cancelTaskMutation.isPending || task.cancelRequested}>
                    {cancelTaskMutation.isPending || task.cancelRequested ? "Cancelling..." : "Cancel"}
                  </ButtonWithSpinner>
              </div>
            )}
            {!task.isComplete && !task.canBeCancelled && (
              <div className="flex flex-row flex-grow justify-end place-items-center">
                <Tooltip>
                  <TooltipTrigger>
                    <ButtonWithSpinner disabled={true}>
                      Cancel
                    </ButtonWithSpinner>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>The task is not safe to cancel at this point.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            )}
          </div>
        </div>
      </div>
      {!task.isComplete && task.progress?.hasProgressValues && (
        <div className="flex flex-row flex-grow">
          <Progress className="w-full duration-1000" value={(task.progress.current/task.progress.total) * 100} />
        </div>
      )}
      {!task.isComplete && !task.progress?.hasProgressValues && (
        <div className="flex flex-row flex-grow">
          <ProgressUncertain className="w-full"/>
        </div>
      )}
      
    </div>
  );
}