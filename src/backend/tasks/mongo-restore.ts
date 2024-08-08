import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { TaskCommands, TaskExecutor, TaskExecuteResult, TaskCancelledError } from "./task-runner";
import { MongoDatabaseAccess } from "@backend/db/mongodb-database.schema";
import { ResolvedTaskState, TaskCancellationType } from "@backend/db/task.schema";
import { backups } from "@backend/db/backup.schema";
import { database } from "@backend/db";
import { eq } from "drizzle-orm";
import { runAndForget } from "@lib/utils";
import { runProcess } from "@lib/process";

export class MongoRestoreExecutor implements TaskExecutor<{backupId:number}> {
    
    async execute(commands: TaskCommands, mongoDatabaseAccess: MongoDatabaseAccess, {backupId: backupIdToRestore}: {backupId: number}): Promise<TaskExecuteResult> {
        try
        {
            const backupToRestore = await database.query.backups.findFirst({ where: eq(backups.id, backupIdToRestore) });
            
            if(!backupToRestore) {
                return {
                    resolvedState: ResolvedTaskState.Error,
                    message: "Backup not found",
                };
            }

            const exists = existsSync(backupToRestore.archivePath);

            if(!exists) {
                return {
                    resolvedState: ResolvedTaskState.Error,
                    message: "Backup archive file not found",
                };
            }

            await commands.setCancellationType(TaskCancellationType.DangerousToCancel);
            
            commands.reportProgress({ hasProgressValues: false,  message: "Restoring backup..." });

            await runProcess({
                command: "mongorestore",
                args: [
                    mongoDatabaseAccess.connectionUri,
                    "--authenticationDatabase=admin",
                    `--nsInclude=${mongoDatabaseAccess.databaseName}.*`,
                    "--drop",
                    "--noIndexRestore",
                    "--gzip",
                    `--archive=${backupToRestore.archivePath}`,
                ]
            });

            return { 
                resolvedState: ResolvedTaskState.Sucessful, 
                message: "Restored successfully",
            };
        }
        catch(e)
        {
            throw e;
        }
    }

}
