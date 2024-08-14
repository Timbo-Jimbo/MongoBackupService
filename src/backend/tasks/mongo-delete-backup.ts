import { TaskCommands, TaskExecutor, TaskExecuteResult } from "./task-runner";
import { MongoDatabaseAccess } from "@backend/db/mongo-database.schema";
import { ResolvedTaskState, TaskCancellationType } from "@backend/db/task.schema";
import { database } from "@backend/db";
import { backups } from "@backend/db/backup.schema";
import { eq } from "drizzle-orm";
import { TaskScheduler } from "./task-scheduler";
import { unlinkSync } from "fs";

type TaskParams = {backupIdsToDelete:number[]};

export class MongoDeleteBackupExecutor implements TaskExecutor<TaskParams> {
    
    async execute(commands: TaskCommands, databases: MongoDatabaseAccess[], {backupIdsToDelete}: TaskParams): Promise<TaskExecuteResult> {

      commands.reportProgress({
        message: "Deleting backup",
        hasProgressValues: false
      });
      await commands.setCancellationType(TaskCancellationType.NotCancellable);

      for(const backupIdToDelete of backupIdsToDelete)
      {
        const backup = await database.query.backups.findFirst({ where: eq(backups.id, backupIdToDelete) });

        if(backup) {
  
            await database.delete(backups).where(eq(backups.id, backupIdToDelete)).execute();
            
            TaskScheduler.clearScheduledDelete(backup);
            
            unlinkSync(backup.archivePath);
            console.log(`Deleted backup ${backup.archivePath}`);
        }
      }

      return { 
        resolvedState: ResolvedTaskState.Completed,
        message: backupIdsToDelete.length > 1 ? "Backups deleted" : "Backup deleted",
      };
    }

}
