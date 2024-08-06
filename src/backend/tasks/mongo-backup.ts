import { TaskCompletionType } from "@backend/db/task.schema";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { MongoClient } from "mongodb";
import { v7 as uuidv7 } from "uuid";
import { TaskUpdateDispatcher, TaskCancelledError } from "./task-update-dispatcher";

interface MongoDatabaseDetails {
    connectionUri: string;
    databaseName: string;
}

async function getCollectionWork(databaseDetails: MongoDatabaseDetails) {

    const client = await MongoClient.connect(databaseDetails.connectionUri);
    try
    {
        const collectionsResult = await client.db(databaseDetails.databaseName).collections();
        const output = [];
        for(const collection of collectionsResult)
        {
            output.push({ 
                name: collection.collectionName,
                totalCount:  await collection.estimatedDocumentCount(),
                backedUpCount: 0,
            });
        }

        return output;
    }
    finally
    {
        await client.close();
    }    
}

export const runMongoBackupTask = async (databaseDetails: MongoDatabaseDetails, taskUpdateDispatcher: TaskUpdateDispatcher) => {

    const backupFolder = "data/tasks";
    mkdirSync(backupFolder, { recursive: true });
    const now = new Date();
    const backupArchiveName = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-${databaseDetails.databaseName}-${uuidv7()}-backup.gz`;
    const backupArchivePath = `${backupFolder}/${backupArchiveName}`;  

    try
    {
        await taskUpdateDispatcher.setCanBeCancelled(true);

        
        taskUpdateDispatcher.queueProgressUpdate({ hasProgressValues: false,  message: "Gathering info" });
        const collectionWork = await getCollectionWork(databaseDetails);
        await taskUpdateDispatcher.throwIfCancelled();

        taskUpdateDispatcher.queueProgressUpdate({ hasProgressValues: false,  message: "Initiating backup..." });

        const childProcess = spawn("mongodump", [
            databaseDetails.connectionUri,
            "--authenticationDatabase=admin",
            "--db=" + databaseDetails.databaseName,
            "--gzip",
            `--archive=${backupArchivePath}`,
            "--verbose"
        ], { stdio: 'pipe' });

        await new Promise<void>((resolve, reject) => {

            let userCancelled = false;
            async function monitorForCancellation() {
                while(childProcess.exitCode === null) {
                    try 
                    {
                        await taskUpdateDispatcher.throwIfCancelled();
                        await new Promise<void>(resolve => setTimeout(resolve, 1000));
                    }
                    catch {
                        console.log("Killing backup process...");
                        userCancelled = true;
                        childProcess.kill();
                        break;
                    }
                }
            }
            monitorForCancellation();

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

                        const knownDatabaseName = databaseDetails.databaseName;

                        let result: {
                            backedUpDocCount: number,
                            totalDocCount: number,
                            percent: number,
                            collectionName: string,
                        } | undefined = undefined;

                        // Example line: 
                        // "2024-08-05T18:28:42.444+1000    [........................]     db-name.col-name  0/294  (0.0%)"
                        if(line.includes("[") && line.includes("]"))
                        {
                            const rawDateTime = lineParts[0];
                            const rawProgressBar = lineParts[1];
                            const rawDbAndCollection = lineParts[2];
                            const rawDocCount = lineParts[3];
                            const rawDocCountParts = rawDocCount.split("/");
                            const rawPercent = lineParts[4].slice(1, -2);

                            const backedUpDocCount = parseInt(rawDocCountParts[0]);
                            const totalDocCount = parseInt(rawDocCountParts[1]);
                            const percent = parseFloat(rawPercent);
                            const collectionName = rawDbAndCollection.slice(knownDatabaseName.length + 1);

                            result = {
                                backedUpDocCount,
                                totalDocCount,
                                percent,
                                collectionName,
                            };
                        }
                        // Example line:
                        // "2024-08-05T18:28:42.313+1000    done dumping db-name.col-name (987 documents)"
                        else if(line.includes("done dumping"))
                        {
                            const rawDateTime = lineParts[0];
                            const rawDbAndCollection = lineParts[3];
                            const rawDocCount = lineParts[4].slice(1);
                            
                            const collectionName = rawDbAndCollection.slice(knownDatabaseName.length + 1);
                            const backedUpDocCount = parseInt(rawDocCount);
                            
                            result = {
                                backedUpDocCount,
                                totalDocCount: backedUpDocCount,
                                percent: 100,
                                collectionName,
                            };
                        }
                        
                        if(result) {

                            anyProgressChange = true;

                            const collection = collectionWork.find(c => c.name === result.collectionName);
                            if(collection)
                            {
                                collection.backedUpCount = result.backedUpDocCount;
                                collection.totalCount = result.totalDocCount;
                            }
                        }
                    }
                    catch (e){
                        console.error("Failed to parse mongodump output line (ignoring):", lineParts);
                        console.error(e);
                    }
                }

                if(anyProgressChange) {

                    const totalDocs = collectionWork.reduce((acc, c) => acc + c.totalCount, 0);
                    const backedUpDocs = collectionWork.reduce((acc, c) => acc + c.backedUpCount, 0);
                    const allDone = collectionWork.every(c => c.backedUpCount === c.totalCount);

                    taskUpdateDispatcher.queueProgressUpdate({
                        message: `Backing up database.`,
                        hasProgressValues: true,
                        current: backedUpDocs,
                        total: totalDocs,
                        countedThingName: "Documents"
                    });
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
            };
    
            const onError = (err: Error) => {
                cleanupListeners();
                reject(userCancelled ? new TaskCancelledError() : err);
            };
    
            const onClose =  (code: number | null) => {
                cleanupListeners();
    
                if (code !== 0) {
                    reject(userCancelled ? new TaskCancelledError() : new Error(`mongodump process exited with code ${code}`));
                }
                else {
                    resolve();
                }
            };
    
            childProcess.on('error', onError);
            childProcess.on('close', onClose);
        });

        console.log("✅ Backup completed");
    
        await taskUpdateDispatcher.completeTask({ 
            completionType: TaskCompletionType.Sucessful, 
            message: "Backup completed",
        });
    }
    catch(e)
    {
        if(e instanceof TaskCancelledError) 
        {
            console.log("🛑 Backup cancelled")
            await taskUpdateDispatcher.completeTask({
                completionType: TaskCompletionType.Cancelled,
                message: "Backup was cancelled"
            });
        }
        else
        {
            console.error("⚠️ Backup failed");
            console.error(e);
    
            await taskUpdateDispatcher.completeTask({
                completionType: TaskCompletionType.Error,
                message: "Something went wrong during backup, please check the server logs for more information"
            });
        }

        if(existsSync(backupArchivePath))
        {
            console.log("Cleaning up backup archive file on disk...");
            unlinkSync(backupArchivePath);
        }
    }
}