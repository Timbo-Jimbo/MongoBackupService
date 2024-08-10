import { existsSync, mkdirSync, unlinkSync, statSync } from "node:fs";
import { v7 as uuidv7 } from "uuid";
import { TaskCommands, TaskExecutor, TaskExecuteResult } from "./task-runner";
import { MongoDatabaseAccess } from "@backend/db/mongo-database.schema";
import { ResolvedTaskState, TaskCancellationType, tasks } from "@backend/db/task.schema";
import { database } from "@backend/db";
import { backups } from "@backend/db/backup.schema";
import { Compression, MongodumpOutputProgressExtractor, getCollectionMetadata } from "./mongo-utils";
import { runProcess, runProcessesPiped } from "@lib/process";
import { BackupCompressionFormat, BackupMode } from "./compression.enums";

export const MongoBackupFolder = "data/backups";

export type Params = {
    backupMode?: BackupMode;
}

export class MongoBackupTaskExecutor implements TaskExecutor<Params> {
    
    async execute(commands: TaskCommands, databases: MongoDatabaseAccess[], { backupMode = BackupMode.Balanced } : Params): Promise<TaskExecuteResult> {

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

            if(backupFormat == BackupCompressionFormat.ZStandard)
            {
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
                        args: [
                            '--adapt',
                            '--long',
                            '-T0',
                            '-',
                            '-o',
                            backupArchivePath,
                        ]
                    }
                ])
            }
            else if(backupFormat == BackupCompressionFormat.Gzip || backupFormat == BackupCompressionFormat.None)
            {
                await runProcess({
                    command: 'mongodump',
                    args: [
                        `--uri=${targetDatabase.connectionUri}`,
                        '--authenticationDatabase=admin',
                        `--db=${targetDatabase.databaseName}`,
                        `--archive=${backupArchivePath}`,
                        (backupFormat == BackupCompressionFormat.Gzip) ? '--gzip' : '',
                    ],
                    stderr: (data) => progessExtractor.processData(data),
                }, async () => {
                    await commands.throwIfCancelled();
                });
            }

            await commands.setCancellationType(TaskCancellationType.NotCancellable);
            await commands.reportProgress({ hasProgressValues: false,  message: "Recording backup entry" });
            
            await database.insert(backups).values([{
                mongoDatabaseId: targetDatabase.id,
                archivePath: backupArchivePath,
                sizeBytes: statSync(backupArchivePath).size,
                format: backupFormat,
                mode: backupMode,
                startedAt: startedAt,
                finishedAt: new Date(),
                sourceMetadata: {
                    databaseName: targetDatabase.databaseName,
                    collections: collectionMetadata.map(cw => ({
                        collectionName: cw.name,
                        documentCount: cw.totalCount,
                    })),
                },
            }]);
        
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
    }

}
