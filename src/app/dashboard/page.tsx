'use client'

import { TaskCard } from "@/components/task"
import { addRandomTask, deleteTask, getAllTasks, updateTask } from "@actions/tasks"
import { LogoutButton } from "@app/login/components"
import { Task, TaskStatus } from "@backend/db/task.schema"
import { ButtonWithSpinner } from "@comp/button"
import { LoadingSpinner } from "@comp/loading-spinner"
import { Separator } from "@comp/separator"
import { useEffect, useState } from "react"

export default function Dashboard() {

  const [isAddingTask, setIsAddingTask] = useState<boolean>(false)
  const [firstLoadComplete, setIsFirstLoadComplete] = useState<boolean>(false)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loadingTaskIds, setLoadingTaskIds] = useState<number[]>([])

  useEffect(() => {
    const fetchTasks = async () => {
      const tasks = await getAllTasks();
      setTasks(tasks);
      setIsFirstLoadComplete(true);
    };
    fetchTasks();
  }, []);

  async function onClick() {

    setIsAddingTask(true)
    try {
      const task = await addRandomTask();
      setTasks([...tasks, task]);
    }
    catch (error) {}
    finally {
    setIsAddingTask(false);
    }
  }

  async function onTaskComplete(task: Task) {
    try
    {
      setLoadingTaskIds([...loadingTaskIds, task.id]);
      const updatedTask = await updateTask(task.id, {status: TaskStatus.Completed});
      setTasks(tasks.map(t => t.id === updatedTask.id ? updatedTask : t));
    }
    finally
    {
      setLoadingTaskIds(loadingTaskIds.filter(id => id !== task.id));
    }
  }

  async function onTaskDelete(task: Task) {
    try
    {
      setLoadingTaskIds([...loadingTaskIds, task.id]);
      await deleteTask(task.id);
      setTasks(tasks.filter(t => t.id !== task.id));
    }
    finally
    {
      setLoadingTaskIds(loadingTaskIds.filter(id => id !== task.id));
    }
  }

  return (
      <main className="flex min-h-screen flex-col place-items-center justify-center p-24">
        
        <div className="flex flex-col place-items-center gap-8 w-full max-w-xl">
          <div className="flex flex-col w-full gap-4">
            <h1>Welcome back!</h1>
            <LogoutButton />
          </div>
          <div className="flex flex-col w-full gap-4">
            <h2 className="text-xl font-semibold">All Tasks</h2>
            {firstLoadComplete && tasks.length === 0 && <p className="opacity-50 text-sm">There are no tasks to show.</p>}
            {!firstLoadComplete && (
              <div className="flex flex-col m-4 place-items-center justify-center">
                <LoadingSpinner className="w-10 h-10 opacity-50" />
              </div>
            )}
            {tasks.map((task) => (
              <>
                <TaskCard 
                  key={task.id}
                  task={task}
                  onCompleteClick={onTaskComplete}
                  onDeleteClick={onTaskDelete}
                  isLoading={loadingTaskIds.includes(task.id)}
                />
                {tasks.indexOf(task) < tasks.length - 1 && <Separator />}
                </>
            ))}
            <ButtonWithSpinner isLoading={isAddingTask} onClick={onClick}>
              {isAddingTask ? "Adding task..." : "Add random task"}
            </ButtonWithSpinner>
          </div>
        </div>
      </main>
  );
}
