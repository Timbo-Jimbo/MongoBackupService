import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { TaskCommands, TaskExecutor, TaskExecuteResult } from "./task-runner";
import { MongoDatabaseAccess } from "@backend/db/mongodb-database.schema";
import { ResolvedTaskState } from "@backend/db/task.schema";
import { backups } from "@backend/db/backup.schema";
import { database } from "@backend/db";
import { eq } from "drizzle-orm";

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

            await commands.setCanBeCancelled(false);
            
            commands.reportProgress({ hasProgressValues: false,  message: "Initiating restore..." });

            const childProcess = spawn("mongorestore", [
                mongoDatabaseAccess.connectionUri,
                "--authenticationDatabase=admin",
                "--nsInclude=" + mongoDatabaseAccess.databaseName + ".*",
                "--drop",
                "--noIndexRestore",
                "--gzip",
                `--archive=${backupToRestore.archivePath}`,
            ], { stdio: 'pipe' });

            commands.reportProgress({ hasProgressValues: false,  message: "Restoring backup" });

            await new Promise<void>((resolve, reject) => {

                const processStdData = (data: Buffer) => {
                   // for now, lets ignore this
                };

                childProcess.stdout && childProcess.stdout.on('data', (data) => {
                    processStdData(data);
                });
        
                childProcess.stderr && childProcess.stderr.on('data', (data) => {
                    processStdData(data);
                });
        
                const cleanupListeners = () => {
                    childProcess.removeListener('error', onError);
                    childProcess.removeListener('close', onClose);
                };
        
                const onError = (err: Error) => {
                    cleanupListeners();
                    reject(err);
                };
        
                const onClose =  (code: number | null) => {
                    cleanupListeners();
        
                    if (code !== 0) {
                        reject(new Error(`mongorestore process exited with code ${code}`));
                    }
                    else {
                        resolve();
                    }
                };
        
                childProcess.on('error', onError);
                childProcess.on('close', onClose);
            });

            return { 
                resolvedState: ResolvedTaskState.Sucessful, 
                message: "Backup restored successfully",
            };
        }
        catch(e)
        {
            throw e;
        }
    }

}
