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
    onCompleteClick: (task:Task) => void,
    onDeleteClick: (task:Task) => void,
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
                {task.status == TaskStatus.Completed && (
                    <div className="flex flex-row flex-grow justify-end place-items-center">
                        <Badge variant={"secondary"} >
                            Completed
                        </Badge>
                    </div>
                )}
                <div className="flex flex-row flex-grow justify-end place-items-center">
                    {task.status == TaskStatus.Pending && (
                        <ButtonWithSpinner className="w-min" onClick={() => onCompleteClick(task)} isLoading={isLoading}>
                            {isLoading ? "Completing..." : "Complete"}
                        </ButtonWithSpinner>
                    )}
                    {task.status == TaskStatus.Completed &&(
                        <ButtonWithSpinner variant={"destructive"} onClick={() => onDeleteClick(task)} isLoading={isLoading}>
                            {isLoading ? "Deleting..." : "Delete"}
                        </ButtonWithSpinner>    
                    )}
                </div>
            </div>
            <div className="flex flex-row flex-grow">
                <Progress className="w-full" value={25} max={100} />
            </div>
        </div>
    );
}