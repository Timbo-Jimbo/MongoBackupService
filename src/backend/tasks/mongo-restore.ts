import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { TaskCommands, TaskExecutor, TaskExecuteResult, TaskCancelledError } from "./task-runner";
import { MongoDatabaseAccess } from "@backend/db/mongodb-database.schema";
import { ResolvedTaskState, TaskCancellationType } from "@backend/db/task.schema";
import { backups } from "@backend/db/backup.schema";
import { database } from "@backend/db";
import { eq } from "drizzle-orm";
import { runAndForget } from "@lib/utils";
import { runProcess, runProcessesPiped } from "@lib/process";
import { BackupCompressionFormat, Compression } from "./mongo-utils";

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

            const compressionFormat = Compression.formatFromExtension(backupToRestore.archivePath);
            const availableCompressionFormats = await Compression.determineAvailableFormats();

            if(!availableCompressionFormats.includes(compressionFormat)) {
                return {
                    resolvedState: ResolvedTaskState.Error,
                    message: `Compression format not supported (${compressionFormat})`,
                };
            }

            await commands.setCancellationType(TaskCancellationType.DangerousToCancel);
            commands.reportProgress({ hasProgressValues: false,  message: "Restoring backup..." });

            if(compressionFormat === BackupCompressionFormat.SevenZip) {
                console.log("Decompressing 7zip archive and restoring");

                await runProcessesPiped([
                    {
                        command: "7z",
                        args: ["x", backupToRestore.archivePath, "-so"]
                    },
                    {
                        command: "mongorestore",
                        args: [
                            mongoDatabaseAccess.connectionUri,
                            "--authenticationDatabase=admin",
                            `--nsInclude=${mongoDatabaseAccess.databaseName}.*`,
                            "--drop",
                            "--noIndexRestore",
                            "--archive"
                        ]
                    }
                ]);

            }
            else if(compressionFormat === BackupCompressionFormat.Gzip) {
                
                console.log("Decompressing gzip archive and restoring");

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
            }
            else {
                return {
                    resolvedState: ResolvedTaskState.Error,
                    message: `Unsupported compression format: ${compressionFormat}`,
                };
            }

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
