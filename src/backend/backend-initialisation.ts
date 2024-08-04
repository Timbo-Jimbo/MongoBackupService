import { eq } from "drizzle-orm";
import { tasks, TaskStatus } from "./db/task.schema";

export async function bootstrap() {
    
    // await require('pino');
    // await require('next-logger');

    const { database } = await import("./db");

    const taskTicker = async () => {

        try 
        {
            const results = await database.query.tasks.findMany({
                where: eq(tasks.status, TaskStatus.Pending)
            })
    
            for (const task of results) {
                
                console.log(`Task ${task.id} is pending, updating to in progress`);
                const randomProgressIncrement = Math.floor(Math.random() * 10) + 1;
                task.progress += randomProgressIncrement;
                if(task.progress > 100) {
                    task.progress = 100;
                    task.status = TaskStatus.Completed;
                }
    
                await database.update(tasks).set({
                    progress: task.progress,
                    status: task.status
                }).where(eq(tasks.id, task.id));
            }
        }
        catch(e){
            console.error("Error in task ticker", e);
        }

        setTimeout(taskTicker, 1000);
    };

    taskTicker();
}
