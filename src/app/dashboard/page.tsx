'use client'

import { TaskCard } from "@/components/task"
import { addRandomTask, deleteTask, getAllTasks, updateTask } from "@actions/tasks"
import { LogoutButton } from "@app/login/components"
import { Task, TaskStatus } from "@backend/db/task.schema"
import { ButtonWithSpinner } from "@comp/button"
import { LoadingSpinner } from "@comp/loading-spinner"
import { Separator } from "@comp/separator"
import { useInterval } from "@lib/use-interval"
import { act, useCallback, useEffect, useReducer, useRef } from "react"

type StatefulTask = Task & { loading: boolean };

interface DashboardState 
{
  isAddingTask: boolean;
  isReady: boolean;
  tasks: StatefulTask[];
}

const initialState: DashboardState = {
  isAddingTask: false,
  isReady: false,
  tasks: [],
}

enum DashboardStateChangeType 
{
  Prepare = "Prepare",
  BeginAddTask = "BeginAddTask",
  EndAddTask = "EndAddTask",
  SetTaskLoading = "SetTaskLoading",
  ClearTaskLoading = "ClearTaskLoading",
  UpdateTasks = "UpdateTasks",
  RemoveTask = "RemoveTask",
}

type PrepareStateChange = {
  type: DashboardStateChangeType.Prepare;
  initialTasks: Task[];
}

type BeginAddTaskStateChange = {
  type: DashboardStateChangeType.BeginAddTask;
}

type EndAddTaskStateChange = {
  type: DashboardStateChangeType.EndAddTask;
  task?: Task;
}

type UpdateTasksStateChange = {
  type: DashboardStateChangeType.UpdateTasks;
  updatedTasks: Task[];
}

type SetTaskLoadingStateChange = {
  type: DashboardStateChangeType.SetTaskLoading;
  taskId: number;
}

type ClearTaskLoadingStateChange = {
  type: DashboardStateChangeType.ClearTaskLoading;
  taskId: number;
}

type RemoveTaskStateChange = {
  type: DashboardStateChangeType.RemoveTask;
  taskId: number;
}

type DashboardStateChange = 
| PrepareStateChange
| BeginAddTaskStateChange
| EndAddTaskStateChange
| SetTaskLoadingStateChange
| ClearTaskLoadingStateChange
| RemoveTaskStateChange
| UpdateTasksStateChange 

function loggingReducer(reducerFn: (state: DashboardState, action: DashboardStateChange) => DashboardState) {
  return (state: DashboardState, action: DashboardStateChange) => {
    console.log("Action: ", action);
    const newState = reducerFn(state, action);
    return newState;
  }
}

function dashboardReducer(state: DashboardState, action: DashboardStateChange): DashboardState {
  switch (action.type) {
    case DashboardStateChangeType.Prepare:
      return {
        ...state,
        isReady: true,
        tasks: action.initialTasks.map(t => ({...t, loading: false}))
      };
    case DashboardStateChangeType.BeginAddTask:
      return {
        ...state,
        isAddingTask: true
      };
    case DashboardStateChangeType.EndAddTask:
      return {
        ...state,
        isReady: true,
        isAddingTask: false,
        tasks: action.task ? 
          [
            ...state.tasks,
            {...action.task, loading: false}
          ] :
          state.tasks
      };
    case DashboardStateChangeType.UpdateTasks:

      if(action.updatedTasks.length === 0) return state;

      return {
        ...state,
        tasks: state.tasks.map(t => {
          return { 
            ...t,
            ...action.updatedTasks.find(rt => rt.id === t.id),
          };
        })
      }
    case DashboardStateChangeType.SetTaskLoading:
      return {
        ...state,
        tasks: state.tasks.map(t => {
          
          if(t.id !== action.taskId) 
            return t;

          return {
            ...t,
            loading: true
          }
        })
      };
    case DashboardStateChangeType.ClearTaskLoading:
      return {
        ...state,
        tasks: state.tasks.map(t => {
          if(t.id !== action.taskId) 
            return t;

          return {
            ...t,
            loading: false
          }
        })
      };
    case DashboardStateChangeType.RemoveTask:
      return {
        ...state,
        tasks: state.tasks.filter(t => t.id !== action.taskId)
      };
    default:
      throw new Error("Invalid action type");
  }
}

export default function Dashboard() {

  const [state, dispatch] = useReducer(loggingReducer(dashboardReducer), initialState);

  //initial data load
  useEffect(() => {
    const fetchTasks = async () => {
      const tasks = await getAllTasks();
      if(!tasks) return;

      dispatch({ type: DashboardStateChangeType.Prepare, initialTasks: tasks });
    };

    fetchTasks();
  }, []);

  const refreshPendingCallback = useCallback(async () => {
    const pendingTaskIds = state.tasks
      .filter(t => t.status === TaskStatus.Pending)
      .map(t => t.id) || [];

    if(pendingTaskIds.length === 0) return

    try 
    {
      const refreshedTasks = await getAllTasks(pendingTaskIds);
      if(!refreshedTasks)return;
      console.log("Refreshed tasks: ", refreshedTasks);
      dispatch({ type: DashboardStateChangeType.UpdateTasks, updatedTasks: refreshedTasks });
    }
    catch(e){
      console.error("Error refreshing pending tasks", e);
    }

  }, [state]);


  useInterval(() => {
    refreshPendingCallback();
  }, 500);

  const onAddClick = useCallback(async () => {
    dispatch({ type: DashboardStateChangeType.BeginAddTask });
    const task = await addRandomTask();
    if(!task) return;
    dispatch({ type: DashboardStateChangeType.EndAddTask, task });
  }, []);

  const onCompleteTaskClick = useCallback(async (taskId: number) => {
    dispatch({ type: DashboardStateChangeType.SetTaskLoading, taskId });
    const updatedTask = await updateTask(taskId, { status: TaskStatus.Completed, progress: 100 });

    if(updatedTask)
      dispatch({ type: DashboardStateChangeType.UpdateTasks, updatedTasks: [updatedTask] });
    
    dispatch({ type: DashboardStateChangeType.ClearTaskLoading, taskId });
  }, []);

  const onDeleteTaskClick = useCallback(async (taskId: number) => {
    dispatch({ type: DashboardStateChangeType.SetTaskLoading, taskId });
    await deleteTask(taskId);
    dispatch({ type: DashboardStateChangeType.RemoveTask, taskId });
    dispatch({ type: DashboardStateChangeType.ClearTaskLoading, taskId });
  }, []);

  return (
      <main className="flex min-h-screen flex-col place-items-center justify-center p-24">
        
        <div className="flex flex-col place-items-center gap-8 w-full max-w-xl">
          <div className="flex flex-col w-full gap-4">
            <h1>Welcome back!</h1>
            <LogoutButton />
          </div>
          <div className="flex flex-col w-full gap-4">
            <h2 className="text-xl font-semibold">All Tasks</h2>
            {state.isReady && state.tasks.length === 0 && <p className="opacity-50 text-sm">There are no tasks to show.</p>}
            {!state.isReady && (
              <div className="flex flex-col m-4 place-items-center justify-center">
                <LoadingSpinner className="w-10 h-10 opacity-50" />
              </div>
            )}
            {state.tasks.map((task, index, tasks) => (
              <div key={task.id}>
                <TaskCard 
                  key={task.id}
                  task={task}
                  onCompleteClick={onCompleteTaskClick}
                  onDeleteClick={onDeleteTaskClick}
                  isLoading={task.loading}
                />
                {index < tasks.length - 1 && <Separator />}
              </div>
            ))}
            <ButtonWithSpinner isLoading={state.isAddingTask} onClick={onAddClick}>
              {state.isAddingTask ? "Adding task..." : "Add random task"}
            </ButtonWithSpinner>
          </div>
        </div>
      </main>
  );
}
