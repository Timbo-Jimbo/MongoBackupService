"use server"

import { database } from "@backend/db";
import { censorMongoDbConnectionUri, TaskUpdateDispatcher, withAuthOrRedirect } from "./common";
import { InsertMongoDatabase, MongoDatabase, MongoDatabaseCensored, mongoDatabases, MongoDatabaseConnection } from "@backend/db/mongodb-instance.schema";
import { MongoClient } from "mongodb"
import { eq } from "drizzle-orm";
import { InsertTask, tasks, TaskStatus, TaskType } from "@backend/db/task.schema";
import { updateTask } from "./tasks";
import { spawn } from "cross-spawn";
import { mkdirSync } from "fs";

function censorMongoDatabase(mongoDatabase: MongoDatabase): MongoDatabaseCensored {
    const result = {
        ...mongoDatabase,
        connectionUri: undefined,
        censoredConnectionUri: censorMongoDbConnectionUri(mongoDatabase.connectionUri),
    };

    delete result.connectionUri;

    return result;
}

export const getMongoDatabaseConnectionStatus = withAuthOrRedirect(async (mongoDatabaseId: number) => {

    const mongoDatabase = await database.query.mongoDatabases.findFirst({ 
        where: eq(mongoDatabases.id, mongoDatabaseId),
        columns: {
            databaseName: true,
            connectionUri: true
        },
    });

    if(!mongoDatabase) 
        throw new Error(`Mongo Database with id ${mongoDatabaseId} not found`);

    const exeCheck = async () => {
        const client = await MongoClient.connect(mongoDatabase.connectionUri);
        try
        {
            const pingResult = await client.db().admin().ping();
            
            if(pingResult["ok"] !== 1)
                return MongoDatabaseConnection.Offline;
            
            //check if database exists
            const dbList = await client.db().admin().listDatabases();

            if(!dbList.ok)
                return MongoDatabaseConnection.Offline;

            if(!dbList.databases.some(db => db.name === mongoDatabase.databaseName))
                return MongoDatabaseConnection.DatabaseMissing;

            return MongoDatabaseConnection.Online;
        }
        finally
        {
            await client.close();
        }    
    };
    
    return {
        connectionStatus:  await exeCheck()
    };
});

export const startManualBackup = withAuthOrRedirect(async (mongoDatabaseId: number) => {
    

    const mongoDatabase = await database.query.mongoDatabases.findFirst({ 
        where: eq(mongoDatabases.id, mongoDatabaseId),
        columns: {
            databaseName: true,
            connectionUri: true
        },
    });

    if(!mongoDatabase) 
        throw new Error(`Mongo Database with id ${mongoDatabaseId} not found`);

    console.log("🔄 User initiated backup for database", mongoDatabase.databaseName);

    const { taskId, dispatcher: taskUpdateDispatcher } = await TaskUpdateDispatcher.createNewTask({ 
        type: TaskType.ScheduledBackup,
    });

    const executeManualBackup = async() => {
        try
        {
            const getCollectionWork = async () => {

                const client = await MongoClient.connect(mongoDatabase.connectionUri);
                try
                {
                    const collectionsResult = await client.db(mongoDatabase.databaseName).collections();

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
            };
            
            taskUpdateDispatcher.queueNextUpdate({
                latestUpdate: "Gathering DB Collection information",
            });

            const collectionWork = await getCollectionWork();

            const backupFolder = "data/tasks";
            mkdirSync(backupFolder, { recursive: true });

            
            taskUpdateDispatcher.queueNextUpdate({
                latestUpdate: "Initiating backup",
            });

            const childProcess = spawn("mongodump", [
                mongoDatabase.connectionUri,
                "--authenticationDatabase=admin",
                "--db=" + mongoDatabase.databaseName,
                "--gzip",
                `--archive=${backupFolder}/backup-manual_task-${taskId}.tgz`,
                "--verbose"
            ], { stdio: 'pipe' });

            await new Promise<void>((resolve, reject) => {

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

                            const knownDatabaseName = mongoDatabase.databaseName;

                            let result: {
                                backedUpDocCount: number,
                                totalDocCount: number,
                                percent: number,
                                collectionName: string,
                            } | undefined = undefined;

                            // Example line: 
                            // "2024-08-05T18:28:42.444+1000    [........................]     db-name.col-name  0/294  (0.0%)"
                            // "2024-08-05T20:00:27.247+1000  [########################]  game-server-dev.mails  5/5  (100.0%)"
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

                        taskUpdateDispatcher.queueNextUpdate({
                            latestUpdate: allDone ? `Wrapping up...` : `Backing up database. ${backedUpDocs}/${totalDocs} Documents backed up.`,
                            progress: collectionWork.reduce((acc, c) => acc + c.backedUpCount, 0) / collectionWork.reduce((acc, c) => acc + c.totalCount, 0) * 100,
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
                    reject(err);
                };
        
                const onClose =  (code: number | null) => {
                    cleanupListeners();
        
                    if (code !== 0) {
                        reject(new Error(`mongodump process exited with code ${code}`));
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
                completionState: TaskStatus.Completed, 
                latestUpdate: "Backup completed",
            });
        }
        catch(e)
        {
            console.error("⚠️ Backup failed");
            console.error(e);

            await taskUpdateDispatcher.completeTask({
                completionState: TaskStatus.Cancelled,
                latestUpdate: "Something went wrong during backup, please check the server logs for more information"
            });
        }
    }

    executeManualBackup();

    return taskId;
});

export const getAllMongoDatabases = withAuthOrRedirect(async (): Promise<MongoDatabaseCensored[]> => {
    const result = await database.query.mongoDatabases.findMany();
    return result.map(censorMongoDatabase);
});

export const addMongoDatabase = withAuthOrRedirect(async (mongoDatabase: InsertMongoDatabase): Promise<MongoDatabaseCensored> => {
    const insertedEntry = await database.insert(mongoDatabases).values([mongoDatabase]).returning();
    return censorMongoDatabase(insertedEntry[0]);
});