import { isMongoDatabaseBusyWithTask } from "@actions/mongo";
import { database } from "@backend/db";
import { MongoDatabaseAccess, mongoDatabases } from "@backend/db/mongodb-database.schema";
import { TaskProgress, TaskType, tasks, TaskState, ResolvedTaskState } from "@backend/db/task.schema";
import { runAndForget } from "@lib/utils";
import { eq } from "drizzle-orm";

export type TaskCommands = {
  reportProgress: TaskRunner["queueProgressUpdate"];
  setCanBeCancelled: TaskRunner["setCanBeCancelled"];
  throwIfCancelled: TaskRunner["throwIfCancelled"];
}

export type TaskExecuteResult = {
  resolvedState: ResolvedTaskState;
  message: string;
}

export type NoTaskParams = undefined | null | void;
type TaskExecutorConstructor<TParam> = { new(): TaskExecutor<TParam>, paramType?: TParam };

export abstract class TaskExecutor<TExecuteParams = any> {
  abstract execute(commands: TaskCommands, databaeAccess: MongoDatabaseAccess, additionalParams: TExecuteParams): Promise<TaskExecuteResult>;
}

export class TaskRunner 
{
  private progressUpdatesAllowed = true;
  private queuedProgressUpdate?: TaskProgress;
  private activeProgressUpdateDispatchLoop?: Promise<void>;

  private constructor(
    private readonly taskId: number,
  ) {}

  get associatedTaskId() {
    return this.taskId;
  } 

  static async startTask<TParam = any>(
  {
    mongoDatabaseId,
    taskType,
    executorClass: executorType,
    executorParams,
    initialTaskUpdate
  }: {
    mongoDatabaseId: number,
    taskType: TaskType,
    executorClass: TaskExecutorConstructor<TParam>,
    initialTaskUpdate?: string
  } & (TParam extends NoTaskParams ? { executorParams?: NoTaskParams } : { executorParams: TParam })
  ) {

    const mongoDatabase = await database.query.mongoDatabases.findFirst({ 
        where: eq(mongoDatabases.id, mongoDatabaseId),
        columns: {
          id: true,
          referenceName: true,
          databaseName: true,
          connectionUri: true
        },
    });

    if(!mongoDatabase) 
    {
      console.log(`🛑 '${taskType}' task rejected - as database was not found`);
      return {
        success: false,
        message: `The database was not found`
      }
    }

    //todo refactor things so that instead of trying to 
    //start a task immediately, we schedule the work to run 
    //once the database is free?  For now, we just reject
    //any new tasks if the database is busy
    if(await isMongoDatabaseBusyWithTask(mongoDatabaseId))
    {
      console.log(`🛑 '${taskType}' task rejected as the database is busy`);
      return {
        success: false,
        message: "The database is busy running another task."
      }
    }

    console.log(`🔄 Starting '${taskType}' task on '${mongoDatabase.referenceName}`);

    const insertResponse = await database.insert(tasks).values([{
      mongoDatabaseId: mongoDatabaseId,
      type: taskType,
      progress: {
        hasProgressValues: false,
        message: initialTaskUpdate ?? "Initializing..."
      }
    }]).returning();
    const taskId = insertResponse[0].id;

    const taskRunner = new TaskRunner(taskId);

    runAndForget(async () => {

      try 
      {
        const executor = new executorType();
        const result = await executor.execute(
          {
            reportProgress: taskRunner.queueProgressUpdate.bind(taskRunner),
            setCanBeCancelled: taskRunner.setCanBeCancelled.bind(taskRunner),
            throwIfCancelled: taskRunner.throwIfCancelled.bind(taskRunner)
          },
          mongoDatabase,
          executorParams as TParam
        );

        console.log(`✅ '${taskType}' task completed`);
        await taskRunner.completeTask(result);
      }
      catch(e)
      {
        if(e instanceof TaskCancelledError) 
        {
          console.log(`🛑 '${taskType}' task cancelled`)
          await taskRunner.completeTask({
            resolvedState: TaskState.Cancelled,
            message: `Task was cancelled`
          });
        }
        else
        {
          console.error(`⚠️ '${taskType}' task failed`);
          console.error(e);
  
          await taskRunner.completeTask({
            resolvedState: TaskState.Error,
            message: "Something went wrong while running the task, please check the server logs for more information"
          });
        }
      }
    });

    return {
      success: true,
      message: "Task started",
      taskId
    }
  }

  queueProgressUpdate(progress: TaskProgress)
  {
    if(!this.progressUpdatesAllowed) return;

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

  async completeTask({ resolvedState, message }: TaskExecuteResult)
  {
    this.progressUpdatesAllowed = false;
    if(this.activeProgressUpdateDispatchLoop)
      await this.activeProgressUpdateDispatchLoop;

    await database.update(tasks).set({
      isComplete: true,
      state: resolvedState,
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

export class TaskCancelledError extends Error {
  constructor() {
    super("Task was cancelled");
  }
}