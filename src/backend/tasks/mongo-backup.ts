import { existsSync, mkdirSync, unlinkSync, statSync } from "node:fs";
import { v7 as uuidv7 } from "uuid";
import { TaskCommands, TaskExecutor, TaskExecuteResult, TaskCancelledError, NoTaskParams as NoAdditionalParams } from "./task-runner";
import { MongoDatabaseAccess } from "@backend/db/mongodb-database.schema";
import { runAndForget } from "@lib/utils";
import { ResolvedTaskState, TaskCancellationType } from "@backend/db/task.schema";
import { database } from "@backend/db";
import { backups } from "@backend/db/backup.schema";
import { BackupCompressionFormat, Compression, MongodumpOutputProgressExtractor, getCollectionMetadata } from "./mongo-utils";
import { ProcessCancelledError, runProcess, runProcessesPiped } from "@lib/process";

export const MongoBackupFolder = "data/backups";

export class MongoBackupTaskExecutor implements TaskExecutor<NoAdditionalParams> {
    
    async execute(commands: TaskCommands, mongoDatabaseAccess: MongoDatabaseAccess): Promise<TaskExecuteResult> {
        mkdirSync(MongoBackupFolder, { recursive: true });
        const now = new Date();
        const backupArchiveName = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-${mongoDatabaseAccess.databaseName}-${uuidv7()}-backup`;
        let backupArchivePath = `${MongoBackupFolder}/${backupArchiveName}`;  

        try
        {
            await commands.setCancellationType(TaskCancellationType.SafeToCancel);
            
            commands.reportProgress({ hasProgressValues: false,  message: "Gathering info" });
            const collectionMetadata = await getCollectionMetadata(mongoDatabaseAccess);
            await commands.throwIfCancelled();

            commands.reportProgress({ hasProgressValues: false,  message: "Initiating backup..." });

            const progessExtractor = new MongodumpOutputProgressExtractor(
                mongoDatabaseAccess,
                collectionMetadata,
                (progress) => {
                    commands.reportProgress({ 
                        hasProgressValues: true,
                        countedThingName: "Documents",
                        total: progress.total,
                        current: progress.current,
                        message: `Backing up database`
                    });
                }
            )

            const compressionFormatsAvailable = await Compression.determineAvailableFormats();
            if(compressionFormatsAvailable.includes(BackupCompressionFormat.SevenZip))
            {
                console.log("Using 7zip compression");
                backupArchivePath = `${backupArchivePath}.${BackupCompressionFormat.SevenZip}`;

                await runProcessesPiped([
                    {
                        command: 'mongodump',
                        args: [
                            `--uri=${mongoDatabaseAccess.connectionUri}`,
                            '--authenticationDatabase=admin',
                            `--db=${mongoDatabaseAccess.databaseName}`,
                            `--archive`,
                        ],
                        stderr: (data) => progessExtractor.processData(data),
                    },
                    {
                        command: '7z',
                        args: ['a', '-si', '-t7z', '-m0=lzma2', '-mx=9', '-mfb=64', '-md=32m', '-ms=on', backupArchivePath],
                    }
                ])
            }
            else if(compressionFormatsAvailable.includes(BackupCompressionFormat.Gzip))
            {
                console.log("Using gzip compression");
                backupArchivePath = `${backupArchivePath}.${BackupCompressionFormat.Gzip}`;

                await runProcess({
                    command: 'mongodump',
                    args: [
                        `--uri=${mongoDatabaseAccess.connectionUri}`,
                        '--authenticationDatabase=admin',
                        `--db=${mongoDatabaseAccess.databaseName}`,
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
            
            await database.insert(backups).values([{
                mongoDatabaseId: mongoDatabaseAccess.id,
                archivePath: backupArchivePath,
                sizeBytes: statSync(backupArchivePath).size,
                sourceMetadata: {
                    databaseName: mongoDatabaseAccess.databaseName,
                    collections: collectionMetadata.map(cw => ({
                        collectionName: cw.name,
                        documentCount: cw.totalCount,
                    })),
                },
            }]);
        
            return { 
                resolvedState: ResolvedTaskState.Sucessful, 
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
