"use client"

import { createContext, useContext } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TaskWithInvolvements } from "@backend/db/task.schema";
import { deleteAllCompletedTasks, getAllTasks, getAllTasksForDatabase } from "@actions/tasks";
import { toastForActionResult } from "@comp/toasts";
import useLocalStorageState from "use-local-storage-state";

type QueryListEntry = TaskWithInvolvements;

const createTaskListQueryClient = (mongoDatabaseId: number | undefined) => {

    const queryClient = useQueryClient();
    const queryKey = ["tasks"];

    const [skeletons, setSkeletonCount] = useLocalStorageState<number>("task-skeletons" + (mongoDatabaseId !== undefined ? `-mdb${mongoDatabaseId}` : ''), {
        defaultValue: 0,
    });
    
    const getAllQuery = useQuery({
        queryKey: queryKey,
        queryFn: async () => {
            const allTasks = await (mongoDatabaseId !== undefined ? getAllTasksForDatabase(mongoDatabaseId) : getAllTasks());
            setSkeletonCount(allTasks?.length ?? 0);
            return allTasks ?? [];
        },
        refetchInterval: (query) =>{
          return !query.state.data || query.state.data.some(t => !t.isComplete) ? 500 : false;
        },
    });

    const clearAllCompletedTasksMutation = useMutation({
        mutationFn: async () => { return await deleteAllCompletedTasks(); },
        onSuccess: (result) => {
            toastForActionResult(result);

            if(result?.success){
                queryClient.setQueryData(queryKey, (entries: QueryListEntry[]): QueryListEntry[] => {
                    const newEntries = entries.filter(entry => !result.clearedTaskIds.includes(entry.id));
                    setSkeletonCount(newEntries.length);
                    return newEntries;
                });
            }
        }
    })

    const notifyTaskWasDeleted = (taskId: number) => {
        queryClient.setQueryData(queryKey, (entries: QueryListEntry[]): QueryListEntry[] => {
            const newEntries = entries.filter(entry => entry.id !== taskId);
            setSkeletonCount(newEntries.length);
            return newEntries;
        });
    };

    const notifyTasksPotentiallyDirty = () => {
        queryClient.invalidateQueries({
            queryKey: queryKey,
            exact: false
        });
    }

    const notifyTaskWasAdded = (task?: TaskWithInvolvements | undefined) => {
        if(task){

            if(mongoDatabaseId !== undefined && !task.involvements.some(i => i.mongoDatabaseId !== mongoDatabaseId)) 
                return;

            queryClient.setQueryData(queryKey, (entries: QueryListEntry[]): QueryListEntry[] => {
                const newEntries = [...entries, task];
                setSkeletonCount(newEntries.length);
                return newEntries;
            });
        }
        else {
            notifyTasksPotentiallyDirty();
        }
    }

    const notifyTaskWasModified = (task: TaskWithInvolvements) => {
        queryClient.setQueryData(queryKey, (entries: QueryListEntry[]): QueryListEntry[] => {
            const newEntries = entries.map(entry => entry.id === task.id ? task : entry);
            setSkeletonCount(newEntries.length);
            return newEntries;
        });
    }

    return {
        queryKey,
        getAllQuery,
        notifyTaskWasAdded,
        notifyTaskWasDeleted,
        notifyTaskWasModified,
        notifyTasksPotentiallyDirty,
        clearAllCompletedTasksMutation,
        skeletonCount: skeletons
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

export const tryUseTaskListQueryClient = () => {
    return useContext(TaskListQueryClient);
}

export const useTaskListQueryClient = () => {
    const value = tryUseTaskListQueryClient();
    if(!value) throw new Error(`${useTaskListQueryClient.name} must be used within a ${TaskListQueryClientProvider.name}`);
    return value;
}