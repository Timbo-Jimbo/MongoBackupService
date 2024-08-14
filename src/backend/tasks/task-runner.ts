import { isMongoDatabaseBusyWithTask } from "@actions/mongo";
import { database } from "@backend/db";
import { MongoDatabase, MongoDatabaseAccess, mongoDatabases } from "@backend/db/mongo-database.schema";
import { InsertMongoDatabaseToTask, mongoDatabasesToTasks } from "@backend/db/mongo-databases-to-tasks.schema";
import { TaskProgress, TaskType, tasks, TaskState, ResolvedTaskState, TaskCancellationType } from "@backend/db/task.schema";
import { humanReadableEnumString, runAndForget } from "@lib/utils";
import { eq } from "drizzle-orm";

export type TaskCommands = {
  reportProgress: TaskRunner["queueProgressUpdate"];
  setCancellationType: TaskRunner["setCancellationType"];
  throwIfCancelled: TaskRunner["throwIfCancelled"];
}

export type TaskExecuteResult = {
  resolvedState: ResolvedTaskState;
  message: string;
}

export type NoTaskParams = undefined | null | void;
type TaskExecutorConstructor<TParam> = { new(): TaskExecutor<TParam>, paramType?: TParam };

export abstract class TaskExecutor<TExecuteParams = any> {
  abstract execute(commands: TaskCommands, databases: MongoDatabaseAccess[], additionalParams: TExecuteParams): Promise<TaskExecuteResult>;
}

type TaskDatabaseInput = {
  mongoDatabaseId: number;
  involvementReason: string;
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
    taskType,
    executorClass,
    executorParams,
    initialTaskUpdate,
    databases = [],
  }: {
    taskType: TaskType,
    executorClass: TaskExecutorConstructor<TParam>,
    initialTaskUpdate?: string,
    databases?: TaskDatabaseInput[] | undefined,
  } & (TParam extends NoTaskParams ? { executorParams?: NoTaskParams } : { executorParams: TParam })
  ) {

    const taskMongoDatabases: MongoDatabase[] = [];

    for(const db of databases)
    {
      const mongoDatabase = await database.query.mongoDatabases.findFirst({ where: eq(mongoDatabases.id, db.mongoDatabaseId) });

      if(!mongoDatabase)
      {
        console.log(`🛑 '${taskType}' task rejected as an additional database was not found`);
        return {
          success: false,
          message: `A database involved in the task was not found`
        }
      }

      //todo refactor things so that instead of trying to 
      //start a task immediately, we schedule the work to run 
      //once the database is free?  For now, we just reject
      //any new tasks if the database is busy
      if(await isMongoDatabaseBusyWithTask(db.mongoDatabaseId))
      {
        console.log(`🛑 '${taskType}' task rejected as a required database is busy`);
        return {
          success: false,
          message: "A database involved in the task is busy with another task."
        }
      }

      taskMongoDatabases.push(mongoDatabase);
    }
    console.log(`🔄 Starting '${taskType}' task`);

    const taskId = await database.transaction(async (tx) => {

      const insertResult = await tx.insert(tasks).values([{
        type: taskType,
        progress: {
          hasProgressValues: false,
          message: initialTaskUpdate ?? "Initializing..."
        }
      }]).returning();

      const taskId = insertResult[0].id;

      const connections: InsertMongoDatabaseToTask[] = databases.map(({ mongoDatabaseId, involvementReason }) => ({
        mongoDatabaseId,
        taskId: taskId,
        reason: involvementReason
      }));

      if(connections.length > 0)
        await tx.insert(mongoDatabasesToTasks).values(connections).returning();

      return taskId;
    });

    const taskRunner = new TaskRunner(taskId);

    runAndForget(async () => {

      try 
      {
        const executor = new executorClass();
        const result = await executor.execute(
          {
            reportProgress: taskRunner.queueProgressUpdate.bind(taskRunner),
            setCancellationType: taskRunner.setCancellationType.bind(taskRunner),
            throwIfCancelled: taskRunner.throwIfCancelled.bind(taskRunner)
          },
          taskMongoDatabases,
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
            resolvedState: TaskState.Failed,
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

  async setCancellationType(type: TaskCancellationType)
  {
    await database.update(tasks).set({ cancellationType: type }).where(eq(tasks.id, this.taskId));    
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