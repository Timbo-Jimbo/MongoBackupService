import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { TaskCommands, TaskExecutor, TaskExecuteResult, TaskCancelledError } from "./task-runner";
import { MongoDatabaseAccess } from "@backend/db/mongo-database.schema";
import { ResolvedTaskState, TaskCancellationType } from "@backend/db/task.schema";
import { backups } from "@backend/db/backup.schema";
import { database } from "@backend/db";
import { eq } from "drizzle-orm";
import { runAndForget } from "@lib/utils";
import { runProcess, runProcessesPiped } from "@lib/process";
import { BackupCompressionFormat, Compression } from "./mongo-utils";

type TaskParams = {backupId:number};

export class MongoRestoreExecutor implements TaskExecutor<TaskParams> {
    
    async prepare(databaseAccess: MongoDatabaseAccess, taskParams: TaskParams): Promise<void> { }

    async execute(commands: TaskCommands, databases: MongoDatabaseAccess[], {backupId: backupIdToRestore}: TaskParams): Promise<TaskExecuteResult> {
        try
        {
            const targetDatabase = databases[0];
            
            const backupToRestore = await database.query.backups.findFirst({ where: eq(backups.id, backupIdToRestore) });
            
            if(!backupToRestore) {
                return {
                    resolvedState: ResolvedTaskState.Failed,
                    message: "Backup not found",
                };
            }

            const exists = existsSync(backupToRestore.archivePath);

            if(!exists) {
                return {
                    resolvedState: ResolvedTaskState.Failed,
                    message: "Backup archive file not found",
                };
            }

            const compressionFormat = Compression.formatFromExtension(backupToRestore.archivePath);
            const availableCompressionFormats = await Compression.determineAvailableFormats();

            if(!availableCompressionFormats.includes(compressionFormat)) {
                return {
                    resolvedState: ResolvedTaskState.Failed,
                    message: `Compression format of the selected backup is not supported on this system (${compressionFormat})`,
                };
            }

            await commands.setCancellationType(TaskCancellationType.DangerousToCancel);
            commands.reportProgress({ hasProgressValues: false,  message: "Restoring backup..." });

            console.log(`Backups compression format is ${compressionFormat}`);
            if(compressionFormat === BackupCompressionFormat.ZStandard) {
                await runProcessesPiped([
                    {
                        command: 'zstd',
                        args: [
                            '-d', 
                            '-c',
                            '--long=30',
                            backupToRestore.archivePath
                        ],
                        stderr: (data) => {
                            console.log(data.toString());
                        }
                    },
                    {
                        command: "mongorestore",
                        args: [
                            targetDatabase.connectionUri,
                            "--authenticationDatabase=admin",
                            `--nsInclude=${targetDatabase.databaseName}.*`,
                            "--drop",
                            "--archive"
                        ]
                    }
                ]);
            }
            else if(compressionFormat === BackupCompressionFormat.Gzip) {
                await runProcess({
                    command: "mongorestore",
                    args: [
                        targetDatabase.connectionUri,
                        "--authenticationDatabase=admin",
                        `--nsInclude=${targetDatabase.databaseName}.*`,
                        "--drop",
                        "--gzip",
                        `--archive=${backupToRestore.archivePath}`,
                    ]
                });
            }
            else {
                return {
                    resolvedState: ResolvedTaskState.Failed,
                    message: `Unsupported compression format: ${compressionFormat}`,
                };
            }

            return { 
                resolvedState: ResolvedTaskState.Completed, 
                message: "Restored successfully",
            };
        }
        catch(e)
        {
            throw e;
        }
    }

}
