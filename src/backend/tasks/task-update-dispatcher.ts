import { database } from "@backend/db";
import { TaskProgressMeta, TaskType, tasks, TaskCompletionType } from "@backend/db/task.schema";
import { eq } from "drizzle-orm";

export class TaskCancelledError extends Error {
    constructor() {
      super("Task was cancelled");
    }
  }
  
  export class TaskUpdateDispatcher 
  {
    private queuedProgressUpdate?: TaskProgressMeta;
    private activeProgressUpdateDispatchLoop?: Promise<void>;
  
    private constructor(
      private readonly taskId: number
    ) {}
  
    static async createNewTask({ mongoDatabaseId, type }: { mongoDatabaseId: number, type: TaskType, initialTaskUpdate?: string })
    {
      const insertResponse = await database.insert(tasks).values([{
        mongoDatabaseId: mongoDatabaseId,
        type: type,
      }]).returning();
  
      const taskId = insertResponse[0].id;  
      return {
        taskId,
        dispatcher: new TaskUpdateDispatcher(taskId)
      };
    }
  
    queueProgressUpdate(progress: TaskProgressMeta)
    {
        this.queuedProgressUpdate = progress;
        this.dispatchProgressUpdate();
    }
  
    async setCanBeCancelled(canBeCancelled: boolean)
    {
      await database.update(tasks).set({ canBeCancelled }).where(eq(tasks.id, this.taskId));    
    }
  
    async throwIfCancelled()
    {
      const task = await database.query.tasks.findFirst({
        where: eq(tasks.id, this.taskId),
        columns: {
          cancelRequested: true
        }
      });
  
      if(task?.cancelRequested)
        throw new TaskCancelledError();
    }
  
    async completeTask({ completionType, message }: { completionType: Exclude<TaskCompletionType, TaskCompletionType.NotComplete>, message: string })
    {
      await this.activeProgressUpdateDispatchLoop;
  
      await database.update(tasks).set({
        isComplete: true,
        completionType,
        progress: {
          hasProgressValues: false,
          message,
        },
        completedAt: new Date()
      }).where(eq(tasks.id, this.taskId));
    }
  
    private dispatchProgressUpdate() {
  
      if(this.activeProgressUpdateDispatchLoop) return;
      this.activeProgressUpdateDispatchLoop = this.dispatchProgressUpdateLoop();
    }
  
    private async dispatchProgressUpdateLoop() 
    {
      try 
      {
        while(this.queuedProgressUpdate) {
        
          const update = this.queuedProgressUpdate;
          this.queuedProgressUpdate = undefined;
          await database.update(tasks).set({
            progress: update
          }).where(eq(tasks.id, this.taskId));
        }
      }
      finally
      {
        this.activeProgressUpdateDispatchLoop = undefined;
      }
    }
  }