import { deleteTask, updateTask } from "@actions/tasks";
import { Task, TaskStatus } from "@backend/db/task.schema";
import { Badge } from "@comp/badge";
import { ButtonWithSpinner } from "@comp/button";
import { LoadingSpinner } from "@comp/loading-spinner";
import { Progress } from "@comp/progress";
import { useQueryClient, useMutation } from "@tanstack/react-query";

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

  const updateTaskMutation = useMutation({
    mutationFn: (update: Partial<Task>) => updateTask({id: task.id, update}),
    onSuccess: (updatedTask) => {

      if(!updatedTask) return;

      queryClient.setQueryData(["tasks"], (tasks: Task[]) => {
        return tasks.map(t => t.id === updatedTask.id ? updatedTask : t);
      });
    }
  });

  const isPending = deleteTaskMutation.isPending || updateTaskMutation.isPending;

  return (
    <div className="flex flex-col my-4 gap-4">
      <div className="flex flex-row flex-grow">
        <div className="flex flex-col gap-2">
          <div className="flex flex-row gap-2 place-items-center">
            <div className="flex flex-row gap-2 place-items-center">
              {task.status == TaskStatus.Pending && <LoadingSpinner className="w-5 h-5" />}
              <h1 className="text-lg font-semibold capitalize">{task.type}</h1>
              {task.status == TaskStatus.Pending && (
                <div className="flex flex-row flex-grow justify-end place-items-center">
                  <Badge variant={"outline"} className="animate-pulse" >
                    Pending
                  </Badge>
                </div>
              )}
              {task.status != TaskStatus.Pending && (
                <div className="flex flex-row flex-grow justify-end place-items-center">
                  <Badge variant={"secondary"} className="capitalize">
                    {task.status}
                  </Badge>
                </div>
              )}
              <p className="text-sm opacity-50">{task.startedAt.toLocaleString()}</p>
            </div>
          </div>
          <p>
            {task.latestUpdate}
          </p>
        </div>

        <div className="flex flex-row flex-grow justify-end place-items-center">
          {task.status == TaskStatus.Pending && (
            <ButtonWithSpinner className="w-min" onClick={() => updateTaskMutation.mutate({status: TaskStatus.Completed, progress: 100})} isLoading={isPending}>
              {isPending ? "Completing..." : "Complete"}
            </ButtonWithSpinner>
          )}
          {(task.status == TaskStatus.Completed || task.status == TaskStatus.Cancelled) && (
            <ButtonWithSpinner variant={"destructive"} onClick={() => deleteTaskMutation.mutate()} isLoading={isPending}>
              {isPending ? "Deleting..." : "Delete"}
            </ButtonWithSpinner>
          )}
        </div>
      </div>
      <div className="flex flex-row flex-grow">
        <Progress className="w-full duration-1000" value={task.progress} max={100} />
      </div>
    </div>
  );
}