"use client"

import { TaskCard } from "@/components/task-card";
import { getAllTasks } from "@actions/tasks";
import { LoadingSpinner } from "@comp/loading-spinner";
import { Separator } from "@radix-ui/react-separator";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export function TaskList() {

  const queryClient = useQueryClient();

  const getTasksQueryKey = ["tasks"];
  const getTasksQuery = useQuery({ 
    queryKey: getTasksQueryKey, 
    queryFn: async (context) => {
      return await getAllTasks();
    },
    refetchInterval: (query) =>{
      return !query.state.data || query.state.data.some(t => !t.isComplete) ? 500 : false;
    },
  });

  const isReady = getTasksQuery.isFetched;
  const tasks = getTasksQuery.data || [];

  return (
    <div className="flex flex-col w-full gap-4">
      <h2 className="text-xl font-semibold">Tasks</h2>
      {isReady && tasks.length === 0 && <p className="opacity-50 text-sm">There are no tasks to show.</p>}
      {!isReady && (
        <div className="flex flex-col m-4 place-items-center justify-center">
          <LoadingSpinner className="w-10 h-10 opacity-50" />
        </div>
      )}
      {tasks.map((task, index, tasks) => (
        <div key={task.id}>
          <TaskCard 
            key={task.id}
            task={task}
          />
          {index < tasks.length - 1 && <Separator />}
        </div>
      ))}
    </div>
  );
}