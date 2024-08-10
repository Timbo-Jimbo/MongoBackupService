import { existsSync } from "node:fs";
import { TaskCommands, TaskExecutor, TaskExecuteResult } from "./task-runner";
import { MongoDatabaseAccess } from "@backend/db/mongo-database.schema";
import { ResolvedTaskState, TaskCancellationType } from "@backend/db/task.schema";
import { backups } from "@backend/db/backup.schema";
import { database } from "@backend/db";
import { eq } from "drizzle-orm";
import { runProcess, runProcessesPiped } from "@lib/process";
import { Compression, MongorestoreOutputProgressExtractor } from "./mongo-utils";
import { BackupCompressionFormat } from "./compression.enums";

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

            const availableCompressionFormats = await Compression.determineAvailableFormats();

            if(!availableCompressionFormats.includes(backupToRestore.format)) {
                return {
                    resolvedState: ResolvedTaskState.Failed,
                    message: `Compression format of the selected backup is not supported on this system (${backupToRestore.format})`,
                };
            }

            await commands.setCancellationType(TaskCancellationType.DangerousToCancel);
            commands.reportProgress({ hasProgressValues: false,  message: "Restoring backup..." });

            const progessExtractor = new MongorestoreOutputProgressExtractor(
                backupToRestore.sourceMetadata.collections.map(c => ({name: c.collectionName, totalCount: c.documentCount})),
                (progress) => {
        
                  if(progress.current >= progress.total)
                  {
                    commands.reportProgress({ 
                      hasProgressValues: false,
                      message: `Finishing up...`
                    });
                  }
                  else
                  {
                    commands.reportProgress({ 
                      hasProgressValues: true,
                      countedThingName: "Documents",
                      total: progress.total,
                      current: progress.current,
                      message: `Restoring documents`
                    });
                  }
                }
              )

            console.log(`Backups compression format is ${backupToRestore.format}`);
            if(
                backupToRestore.format === BackupCompressionFormat.ZStandardFast || 
                backupToRestore.format === BackupCompressionFormat.ZStandardAdapative || 
                backupToRestore.format === BackupCompressionFormat.ZStandardCompact
            ) {
                await runProcessesPiped([
                    {
                        command: 'zstd',
                        args: [
                            '-d', 
                            '-c',
                            '--long',
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
                        ],
                        stderr: (data) => {
                            progessExtractor.processData(data);
                        }
                    }
                ]);
            }
            else if(backupToRestore.format === BackupCompressionFormat.Gzip) {
                await runProcess({
                    command: "mongorestore",
                    args: [
                        targetDatabase.connectionUri,
                        "--authenticationDatabase=admin",
                        `--nsInclude=${targetDatabase.databaseName}.*`,
                        "--drop",
                        "--gzip",
                        `--archive=${backupToRestore.archivePath}`,
                    ],
                    stderr: (data) => {
                        progessExtractor.processData(data);
                    }
                });
            }
            else {
                return {
                    resolvedState: ResolvedTaskState.Failed,
                    message: `Unsupported compression format: ${backupToRestore.format}`,
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
