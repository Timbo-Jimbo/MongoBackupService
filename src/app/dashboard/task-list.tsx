"use client"

import { SkeletonList } from "@/components/skeleton-list";
import { TaskCard } from "@/components/task-card";
import { ButtonWithSpinner } from "@comp/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@comp/card";
import { Separator } from "@comp/separator";
import { useTaskListQueryClient } from "@lib/providers/task-list-query-client";
import { InfoCircledIcon } from "@radix-ui/react-icons";
import { Fragment } from "react";

export function TaskList() {

  const taskListQueryClient = useTaskListQueryClient();

  const isReady = taskListQueryClient.getAllQuery.isFetched;
  const tasks = taskListQueryClient.getAllQuery.data || [];

  return (
    <Card className="flex flex-col w-full border-0 lg:border">
      <CardHeader>
        <CardTitle className="text-xl font-bold flex justify-between items-center">
          <span>Tasks</span>
          {tasks.filter(t => t.isComplete).length > 1 && (
            <ButtonWithSpinner 
              variant={"ghost"} 
              onClick={() => taskListQueryClient.clearAllCompletedTasksMutation.mutate()} 
              isLoading={taskListQueryClient.clearAllCompletedTasksMutation.isPending}
            >
              Clear History
            </ButtonWithSpinner>
          )}
        </CardTitle>
        <CardDescription>
          Manage running tasks and view task history.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isReady && tasks.length === 0 && <p className="text-muted-foreground text-sm"><InfoCircledIcon className="w-4 h-4 mr-2 inline" />There are no tasks to show.</p>}
        {!isReady && <SkeletonList count={taskListQueryClient.skeletonCount} className="h-[5rem]"/>}
        {tasks.map((task, index, tasks) => (
          <Fragment key={task.id}>
            <TaskCard 
              task={task}
            />
            {index < tasks.length - 1 && <Separator className="my-4" />}
          </Fragment>
        ))}
      </CardContent>
    </Card>
  );
}