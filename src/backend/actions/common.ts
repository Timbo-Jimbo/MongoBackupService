import { database } from '@backend/db';
import { InsertTask, tasks, TaskStatus, TaskType, UpdateTask } from '@backend/db/task.schema';
import { UserAuth } from '@backend/user-auth';
import { mockDelay } from '@lib/utils';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

type ServerAction<T extends any[], R> = (...args: T) => Promise<R>;
type Maybe<R> = R | undefined;

export function withAuthOrRedirect<T extends any[], R>(
  action: ServerAction<T, R>
): ServerAction<T, Maybe<R>> {
  return async (...args: T): Promise<Maybe<R>> => {
    
    validAuthOrRedirect();      
    await mockDelay();
    return action(...args);
  };
}

export function validAuthOrRedirect(redirectTo?: string | undefined) {

    if(!UserAuth.isAuthenticated()) {
        
        const searchParams = new URLSearchParams();
        searchParams.set("login-prompt", "true");

        if(!redirectTo) {
          
          const headerUrl = headers().get("x-url");
          const headerOrigin = headers().get("x-origin");        
          const pathWithParams = headerUrl?.substring(headerOrigin?.length || 0);
          redirectTo = pathWithParams;
        }

        if(redirectTo && redirectTo !== "/") 
          searchParams.set("redirect", redirectTo);

        redirect("/login?" + searchParams.toString());
    }
}

export function censorMongoDbConnectionUri(url: string): string {
  // Regular expression to match MongoDB connection URL
  const regex = /^(mongodb(?:\+srv)?:\/\/)([^:]+):([^@]+)@(.+)$/;

  // Replace auth details with asterisks
  return url.replace(regex, (_, protocol, username, password, rest) => {
    const censoredUsername = username.length > 3 
      ? username.slice(0, 3) + '*'.repeat(username.length - 3)
      : '*'.repeat(username.length);
    
    const censoredPassword = '*'.repeat(password.length);

    return `${protocol}${censoredUsername}:${censoredPassword}@${rest}`;
  });
}

export class TaskUpdateDispatcher 
{
  private queuedUpdate?: UpdateTask;
  private activeDispatchLoop?: Promise<void>;

  private constructor(
    private readonly taskId: number
  ) {}

  static async createNewTask({ type, initialTaskUpdate = "Starting up..." }: { type: TaskType, initialTaskUpdate?: string })
  {
    const insertResponse = await database.insert(tasks).values([{
      type: type,
      status: TaskStatus.Pending,
      latestUpdate: initialTaskUpdate,
    }]).returning();

    const taskId = insertResponse[0].id;  
    return {
      taskId,
      dispatcher: new TaskUpdateDispatcher(taskId)
    };
  }

  queueNextUpdate(update: UpdateTask)
  {
      this.queuedUpdate = update;
      this.dispatchUpdate();
  }

  async completeTask({ completionState, latestUpdate }: { completionState: TaskStatus.Cancelled | TaskStatus.Completed, latestUpdate: string })
  {
    this.queueNextUpdate({
      status: completionState,
      progress: 100,
      latestUpdate: latestUpdate,
      completedAt: new Date()
    });

    await this.activeDispatchLoop;
  }

  private dispatchUpdate() {

    if(this.activeDispatchLoop) return;
    this.activeDispatchLoop = this.dispatchLoop();
  }

  private async dispatchLoop() 
  {
    try 
    {
      while(this.queuedUpdate) {
      
        const update = this.queuedUpdate;
        this.queuedUpdate = undefined;
        await database.update(tasks).set(update).where(eq(tasks.id, this.taskId));
      }
    }
    finally
    {
      this.activeDispatchLoop = undefined;
    }
  }
}
