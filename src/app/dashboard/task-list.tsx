"use client"

import { TaskCard } from "@/components/task-card";
import { getAllTasks } from "@actions/tasks";
import { LoadingSpinner } from "@comp/loading-spinner";
import { useTaskListQueryClient } from "@lib/providers/task-list-query-client";
import { Separator } from "@radix-ui/react-separator";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment } from "react";

export function TaskList() {

  const taskListQueryClient = useTaskListQueryClient();

  const isReady = taskListQueryClient.getAllQuery.isFetched;
  const tasks = taskListQueryClient.getAllQuery.data || [];

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
        <Fragment key={task.id}>
          <TaskCard 
            task={task}
          />
          {index < tasks.length - 1 && <Separator />}
        </Fragment>
      ))}
    </div>
  );
}