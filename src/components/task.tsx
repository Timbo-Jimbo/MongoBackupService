import { Task, TaskStatus } from "@backend/db/task.schema";
import { Badge } from "@comp/badge";
import { ButtonWithSpinner } from "@comp/button";
import { LoadingSpinner } from "@comp/loading-spinner";
import { Progress } from "@comp/progress";

export function TaskCard({ 
    task, 
    onCompleteClick, 
    onDeleteClick, 
    isLoading 
} : { 
    task: Task,
    onCompleteClick: (taskId: number) => void,
    onDeleteClick: (taskId: number) => void,
    isLoading: boolean
}) {
    return (
        <div className="flex flex-col my-4 gap-4">
            <div className="flex flex-row flex-grow">
                <div className="flex flex-col gap-2">
                    <div className="flex flex-row gap-2 place-items-center">
                        <div className="flex flex-row gap-2 place-items-baseline">
                            <h1 className="text-lg font-semibold capitalize">{task.type}</h1>
                            <p className="text-sm opacity-50">{task.startedAt.toLocaleString()}</p>
                        </div>
                    </div>
                    <p>
                        {task.latestUpdate}
                    </p>
                </div>
                {task.status == TaskStatus.Pending && (
                    <div className="flex flex-row flex-grow justify-end place-items-center">
                        <Badge variant={"outline"} >
                                <LoadingSpinner className="mr-2 w-3 h-3" />
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
                <div className="flex flex-row flex-grow justify-end place-items-center">
                    {task.status == TaskStatus.Pending && (
                        <ButtonWithSpinner className="w-min" onClick={() => onCompleteClick(task.id)} isLoading={isLoading}>
                            {isLoading ? "Completing..." : "Complete"}
                        </ButtonWithSpinner>
                    )}
                    {(task.status == TaskStatus.Completed || task.status == TaskStatus.Cancelled) &&(
                        <ButtonWithSpinner variant={"destructive"} onClick={() => onDeleteClick(task.id)} isLoading={isLoading}>
                            {isLoading ? "Deleting..." : "Delete"}
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