import { eq } from "drizzle-orm";
import { TaskProgress, tasks, TaskState } from "./db/task.schema";

export async function bootstrap() {
    const { database } = await import("./db");

    const pendingTasks = await database.query.tasks.findMany({
        where: eq(tasks.isComplete, false)
    });

    for (const task of pendingTasks) {
        console.log("Pending task on start up... cleaning up!", task.id);
        
        await database.update(tasks).set({
            state: TaskState.Failed,
            isComplete: true,
            completedAt: new Date(),
            progress: {
                hasProgressValues: false,
                message: "Task was interupted by server shutdown."
            } as TaskProgress
        }).where(eq(tasks.id, task.id));
    }

    //todo... clean up orphaned backup files
}
