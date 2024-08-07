"use client"

import { createContext, useContext } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Task, TaskState, TaskType } from "@backend/db/task.schema";
import { getAllTasks, getAllTasksForDatabase } from "@actions/tasks";
import { tryUseBackupListQueryClient } from "./backup-list-query-client";
import { tryUseMongoDatabaseListQueryClient } from "./mongo-database-list-query-client";

type QueryListEntry = Task;

const createTaskListQueryClient = (mongoDatabaseId: number | undefined) => {

    const backupsQueryClient = tryUseBackupListQueryClient();
    const mongoDatabasesQueryClient = tryUseMongoDatabaseListQueryClient();

    const queryClient = useQueryClient();
    const queryKey = ["tasks"];

    const getAllQuery = useQuery({
        queryKey: queryKey,
        queryFn: async () => {
            const allTasks = await (mongoDatabaseId !== undefined ? getAllTasksForDatabase(mongoDatabaseId) : getAllTasks());
            return allTasks ?? [];
        },
        refetchInterval: (query) =>{
          return !query.state.data || query.state.data.some(t => !t.isComplete) ? 500 : false;
        },
    });

    const notifyTaskWasDeleted = (taskId: number) => {
        queryClient.setQueryData(queryKey, (entries: QueryListEntry[]): QueryListEntry[] => {
            return entries.filter(entry => entry.id !== taskId);
        });
    };

    const notifyTaskWasAdded = (task?: Task | undefined) => {
        if(task){

            if(mongoDatabaseId !== undefined && task.mongoDatabaseId !== mongoDatabaseId) 
                return;

            queryClient.setQueryData(queryKey, (entries: QueryListEntry[]): QueryListEntry[] => {
                return [...entries, task];
            });
        }
        else {
            queryClient.invalidateQueries({
                queryKey: queryKey,
                exact: false
            });
        }
    }

    const notifyTaskWasModified = (task: Task) => {
        queryClient.setQueryData(queryKey, (entries: QueryListEntry[]): QueryListEntry[] => {
            return entries.map(entry => entry.id === task.id ? task : entry);
        });

        if(task.state === TaskState.Sucessful) {
            backupsQueryClient?.notifyBackupsPotentiallyDirty();
            mongoDatabasesQueryClient?.notifyDAtabasesPotentiallyDirty();
        }
    }

    return {
        queryKey,
        getAllQuery,
        notifyTaskWasAdded,
        notifyTaskWasDeleted,
        notifyTaskWasModified
    }
}

type TaskListQueryClientContextValue = ReturnType<typeof createTaskListQueryClient>;
const TaskListQueryClient = createContext<TaskListQueryClientContextValue | null>(null);

export const TaskListQueryClientProvider = ({
    children,
    mongoDatabaseId,
}: {
    children: React.ReactNode,
    mongoDatabaseId?: number | undefined
}) => {
    const value = createTaskListQueryClient(mongoDatabaseId);
    return ( 
        <TaskListQueryClient.Provider value={value}>
            {children}
        </TaskListQueryClient.Provider>
    );
}

export const useTaskListQueryClient = () => {
    const value = useContext(TaskListQueryClient);
    if(!value) throw new Error(`${useTaskListQueryClient.name} must be used within a ${TaskListQueryClientProvider.name}`);
    return value;
}