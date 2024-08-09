import { existsSync, mkdirSync, unlinkSync, statSync } from "node:fs";
import { v7 as uuidv7 } from "uuid";
import { TaskCommands, TaskExecutor, TaskExecuteResult, TaskCancelledError, NoTaskParams as NoAdditionalParams } from "./task-runner";
import { MongoDatabaseAccess } from "@backend/db/mongo-database.schema";
import { runAndForget } from "@lib/utils";
import { ResolvedTaskState, TaskCancellationType } from "@backend/db/task.schema";
import { database } from "@backend/db";
import { backups } from "@backend/db/backup.schema";
import { BackupCompressionFormat, Compression, MongodumpOutputProgressExtractor, getCollectionMetadata } from "./mongo-utils";
import { ProcessCancelledError, runProcess, runProcessesPiped } from "@lib/process";

export const MongoBackupFolder = "data/backups";

export class MongoBackupTaskExecutor implements TaskExecutor<NoAdditionalParams> {
    
    async execute(commands: TaskCommands, databases: MongoDatabaseAccess[]): Promise<TaskExecuteResult> {

        const targetDatabase = databases[0];

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

            const compressionFormatsAvailable = await Compression.determineAvailableFormats();
            const formatOfChoice = compressionFormatsAvailable[0] ?? BackupCompressionFormat.Gzip;
            console.log(`Backing up using ${formatOfChoice} compression`);
            backupArchivePath = `${backupArchivePath}.${formatOfChoice}`;

            if(formatOfChoice == BackupCompressionFormat.ZStandard)
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
                            '-22',
                            '--ultra',
                            '--long=30',
                            '-T0',
                            '-',
                            '-o',
                            backupArchivePath,
                        ]
                    }
                ])
            }
            else if(formatOfChoice == BackupCompressionFormat.Gzip)
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
            
            await database.insert(backups).values([{
                mongoDatabaseId: targetDatabase.id,
                archivePath: backupArchivePath,
                sizeBytes: statSync(backupArchivePath).size,
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
