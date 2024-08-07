import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { TaskCommands, TaskExecutor, TaskExecuteResult, TaskCancelledError } from "./task-runner";
import { MongoDatabaseAccess } from "@backend/db/mongodb-database.schema";
import { ResolvedTaskState, TaskCancellationType } from "@backend/db/task.schema";
import { backups } from "@backend/db/backup.schema";
import { database } from "@backend/db";
import { eq } from "drizzle-orm";
import { runAndForget } from "@lib/utils";

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

                let userCancelled = false;
                let monitoringForCancellation = true;

                runAndForget(async () => {
                    while(monitoringForCancellation) {
                        try 
                        {
                            await commands.throwIfCancelled();
                            await new Promise<void>(resolve => setTimeout(resolve, 1000));
                        }
                        catch {
                            console.log("Killing restore process...");
                            userCancelled = true;
                            childProcess.kill();
                            break;
                        }
                    }
                });

                const processStdData = (data: Buffer) => {
                    // hacky, lets pick apart the output to figure out how many
                    // documents have been backed up per collection.
                    const str = data.toString();
                    const lines = str.split("\n");
                    let anyProgressChange = false;

                    for(const line of lines)
                    {
                        if(line.length === 0) continue;
                        const lineParts = line.split(/\s+/).filter(part => part.length > 0);
                        if(lineParts.length == 0) continue;

                        try
                        {
                            const knownDatabaseName = mongoDatabaseAccess.databaseName;

                            //todo...
                        }
                        catch (e){
                            console.error("Failed to parse mongorestore output line (ignoring):", lineParts);
                            console.error(e);
                        }
                    }

                    if(anyProgressChange) {
                    }
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
                    monitoringForCancellation = false;
                };
        
                const onError = (err: Error) => {
                    cleanupListeners();
                    reject(userCancelled ? new TaskCancelledError() : err);
                };
        
                const onClose =  (code: number | null) => {
                    cleanupListeners();
        
                    if (code !== 0) {
                        reject(userCancelled ? new TaskCancelledError() : new Error(`mongorestore process exited with code ${code}`));
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
                message: "Restored successfully",
            };
        }
        catch(e)
        {
            throw e;
        }
    }

}
