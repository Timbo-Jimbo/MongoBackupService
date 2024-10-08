import { existsSync, mkdirSync, unlinkSync, statSync } from "node:fs";
import { v7 as uuidv7 } from "uuid";
import { TaskCommands, TaskExecutor, TaskExecuteResult } from "./task-runner";
import { MongoDatabaseAccess } from "@backend/db/mongo-database.schema";
import { ResolvedTaskState, TaskCancellationType } from "@backend/db/task.schema";
import { database } from "@backend/db";
import { backups } from "@backend/db/backup.schema";
import { Compression, MongodumpOutputProgressExtractor, getCollectionMetadata } from "./mongo-utils";
import { runProcess, runProcessesPiped } from "@lib/process";
import { BackupCompressionFormat, BackupMode } from "./compression.enums";
import { backupPolicies, BackupPolicy } from "@backend/db/backup-policy.schema";
import { eq } from "drizzle-orm";
import { TaskScheduler } from "./task-scheduler";
import cronParser from "cron-parser";

export const MongoBackupFolder = "data/backups";

export type Params = {
    backupMode?: BackupMode;
    backupPolicy?: BackupPolicy
}

export class MongoBackupTaskExecutor implements TaskExecutor<Params> {
    
    async execute(commands: TaskCommands, databases: MongoDatabaseAccess[], { backupMode = BackupMode.Balanced, backupPolicy } : Params): Promise<TaskExecuteResult> {

        const targetDatabase = databases[0];
        const startedAt = new Date();

        mkdirSync(MongoBackupFolder, { recursive: true });
        const now = new Date();
        const backupArchiveName = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-${targetDatabase.databaseName}-${uuidv7()}-backup`;
        let backupArchivePath = `${MongoBackupFolder}/${backupArchiveName}`;  

        try
        {
            await commands.setCancellationType(TaskCancellationType.SafeToCancel);
            
            commands.reportProgress({ hasProgressValues: false,  message: "Gathering info" });
            const collectionMetadata = await getCollectionMetadata(targetDatabase);
            await commands.throwIfCancelled();

            commands.reportProgress({ hasProgressValues: false,  message: "Initiating backup..." });

            const progessExtractor = new MongodumpOutputProgressExtractor(
                targetDatabase,
                collectionMetadata,
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
                            message: `Backing up database`
                        });
                    }
                }
            )

            const backupFormat = Compression.formatFromMode(backupMode);
            {
                const availableFormats = await Compression.determineAvailableFormats();
                if(!availableFormats.includes(backupFormat)){
                    return {
                        resolvedState: ResolvedTaskState.Failed,
                        message: `Backup mode '${backupMode}' is not supported on this system`,
                    }
                }
            }

            console.log(`Backing up using ${backupFormat} compression`);
            backupArchivePath = `${backupArchivePath}.${Compression.formatToExtension(backupFormat)}`;

            if( 
                backupFormat === BackupCompressionFormat.ZStandardFast || 
                backupFormat === BackupCompressionFormat.ZStandardBalanced || 
                backupFormat === BackupCompressionFormat.ZStandardCompact 
            ) {
                const zstdArgs = [
                    '--long',
                    '-T0',
                    '-',
                    '-o',
                    backupArchivePath,
                ];

                if(backupFormat === BackupCompressionFormat.ZStandardFast)
                {
                    zstdArgs.unshift('-5');
                }
                else if(backupFormat === BackupCompressionFormat.ZStandardBalanced)
                {
                    zstdArgs.unshift('-16');
                }
                else if(backupFormat === BackupCompressionFormat.ZStandardCompact)
                {
                    zstdArgs.unshift('-19');
                }

                await runProcessesPiped([
                    {
                        command: 'mongodump',
                        args: [
                            `--uri=${targetDatabase.connectionUri}`,
                            '--authenticationDatabase=admin',
                            `--db=${targetDatabase.databaseName}`,
                            `--archive`,
                        ],
                        stderr: (data) => progessExtractor.processData(data),
                    },
                    {
                        command: 'zstd',
                        args: zstdArgs
                    }
                ], async () => {
                    await commands.throwIfCancelled();
                });
            }
            else if(backupFormat === BackupCompressionFormat.Gzip)
            {
                await runProcess({
                    command: 'mongodump',
                    args: [
                        `--uri=${targetDatabase.connectionUri}`,
                        '--authenticationDatabase=admin',
                        `--db=${targetDatabase.databaseName}`,
                        `--archive=${backupArchivePath}`,
                        `--gzip`,
                    ],
                    stderr: (data) => progessExtractor.processData(data),
                }, async () => {
                    await commands.throwIfCancelled();
                });
            }

            await commands.setCancellationType(TaskCancellationType.NotCancellable);
            await commands.reportProgress({ hasProgressValues: false,  message: "Recording backup entry" });
            
            const [ newBackup ] = await database.insert(backups).values([{
                mongoDatabaseId: targetDatabase.id,
                archivePath: backupArchivePath,
                sizeBytes: statSync(backupArchivePath).size,
                format: backupFormat,
                mode: backupMode,
                startedAt: startedAt,
                finishedAt: new Date(),
                backupPolicyId: backupPolicy?.id,
                sourceMetadata: {
                    databaseName: targetDatabase.databaseName,
                    collections: collectionMetadata.map(cw => ({
                        collectionName: cw.name,
                        documentCount: cw.totalCount,
                    })),
                },
            }]).returning();

            if(backupPolicy) {
                TaskScheduler.scheduleDelete(backupPolicy, newBackup);
            }
        
            return { 
                resolvedState: ResolvedTaskState.Completed, 
                message: "Backup completed",
            };
        }
        catch(e)
        {
            if(existsSync(backupArchivePath))
            {
                console.log("An error was thrown - deleting incomplete backup archive file...");
                unlinkSync(backupArchivePath);
            }

            throw e;
        }
        finally
        {
            if(backupPolicy){
                
                const interval = cronParser.parseExpression(backupPolicy.backupIntervalCron);
                [ backupPolicy ] = await database.update(backupPolicies).set({
                    lastBackupAt: new Date(),
                    nextBackupAt: interval.hasNext() ? new Date(interval.next().getTime()) : null,
                }).where(eq(backupPolicies.id, backupPolicy.id)).returning();

                await TaskScheduler.scheduleRun(backupPolicy);
            }
        }
    }

}
