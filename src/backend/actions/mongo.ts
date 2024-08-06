"use server"

import { database } from "@backend/db";
import { InsertMongoDatabase, MongoDatabase, MongoDatabaseCensored, mongoDatabases, MongoDatabaseConnection } from "@backend/db/mongodb-database.schema";
import { MongoClient } from "mongodb"
import { eq } from "drizzle-orm";
import { TaskType } from "@backend/db/task.schema";
import { runMongoBackupTask as startMongoBackupTask } from "@backend/tasks/mongo-backup";
import { TaskUpdateDispatcher } from "@backend/tasks/task-update-dispatcher";
import { censorMongoDbConnectionUri } from "@backend/utils";
import { withAuthOrRedirect } from "./utils";

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
        mongoDatabaseId: mongoDatabaseId,
        type: TaskType.ManualBackup,
    });

    startMongoBackupTask(mongoDatabase, taskUpdateDispatcher);

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