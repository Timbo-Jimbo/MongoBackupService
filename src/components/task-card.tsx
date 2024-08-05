import { deleteTask, updateTask } from "@actions/tasks";
import { Task, TaskStatus } from "@backend/db/task.schema";
import { Badge } from "@comp/badge";
import { ButtonWithSpinner } from "@comp/button";
import { LoadingSpinner } from "@comp/loading-spinner";
import { Progress, ProgressUncertain } from "@comp/progress";
import { ClockIcon } from "@heroicons/react/20/solid";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import humanizeDuration from "humanize-duration";

export function TaskCard({
  task,
}: {
  task: Task,
}) {

  const queryClient = useQueryClient();

  const deleteTaskMutation = useMutation({
    mutationFn: () => deleteTask(task.id),
    onSuccess: () => {
      queryClient.setQueryData(["tasks"], (tasks: Task[]) => {
        return tasks.filter(t => t.id !== task.id);
      });
    }
  });

  const isPending = deleteTaskMutation.isPending;

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
              {task.status == TaskStatus.Running && (
                <Badge variant={"outline"} className="animate-pulse" >
                  Pending
                </Badge>
              )}
              {task.status != TaskStatus.Running && (
                <Badge variant={"secondary"} className="capitalize">
                  {task.status}
                </Badge>
              )}
              <p className="grow text-sm opacity-50 text-right">{task.startedAt.toLocaleString(undefined, {dateStyle: "medium", timeStyle: "short"})}</p>
            </div>
          </div>
          <div className="flex flex-row gap-2 place-items-center">
            {task.status == TaskStatus.Running && <LoadingSpinner className="w-5 h-5" />}
            {task.progress && <p>{task.progress.message}</p>}
            {task.status == TaskStatus.Running && task.progress?.hasProgressValues && (
              <div className="grow text-right text-sm">
                {task.progress.current.toLocaleString()} 
                <span className="opacity-50 text-xs"> of {task.progress.total.toLocaleString()} {task.progress.countedThingName}</span>
              </div>
            )}
            
          {(task.status == TaskStatus.Completed || task.status == TaskStatus.Failed) && (
            <div className="flex flex-row flex-grow justify-end place-items-center">
                <ButtonWithSpinner variant={"outline"} onClick={() => deleteTaskMutation.mutate()} isLoading={isPending}>
                  {isPending ? "Clearing..." : "Clear"}
                </ButtonWithSpinner>
            </div>
          )}
          </div>
        </div>
      </div>
      {task.status == TaskStatus.Running && task.progress?.hasProgressValues && (
        <div className="flex flex-row flex-grow">
          <Progress className="w-full duration-1000" value={(task.progress.current/task.progress.total) * 100} />
        </div>
      )}
      {task.status == TaskStatus.Running && !task.progress?.hasProgressValues && (
        <div className="flex flex-row flex-grow">
          <ProgressUncertain className="w-full opacity-50" value={100}/>
        </div>
      )}
    </div>
  );
}