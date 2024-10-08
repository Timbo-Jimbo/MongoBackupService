"use server"

import { database } from "@backend/db";
import { InsertMongoDatabase, MongoDatabase, MongoDatabaseCensored, mongoDatabases, MongoDatabaseConnection } from "@backend/db/mongo-database.schema";
import { MongoClient } from "mongodb"
import { desc, eq } from "drizzle-orm";
import { Task, tasks, TaskType, TaskWithRelations } from "@backend/db/task.schema";
import { TaskRunner } from "@backend/tasks/task-runner";
import { censorMongoDbConnectionUri } from "@backend/utils";
import { withAuthOrRedirect } from "./utils";
import { MongoBackupTaskExecutor } from "@backend/tasks/mongo-backup";
import { backups } from "@backend/db/backup.schema";
import { MongoRestoreExecutor } from "@backend/tasks/mongo-restore";
import { MongoImportExecutor } from "@backend/tasks/mongo-import";
import { BackupMode } from "@backend/tasks/compression.enums";
import { mongoDatabasesToTasks } from "@backend/db/mongo-databases-to-tasks.schema";
import { backupPolicies } from "@backend/db/backup-policy.schema";

function censorMongoDatabase(mongoDatabase: MongoDatabase): MongoDatabaseCensored {
    
    const result = {
        ...mongoDatabase,
        connectionUri: undefined,
        censoredConnectionUri: censorMongoDbConnectionUri(mongoDatabase.connectionUri),
    };

    delete result.connectionUri;

    return result;
}

export const tryGetLatestTask =  async (mongoDatabaseId: number) : Promise<TaskWithRelations | undefined> => {
    
    const entry = await database.query.mongoDatabasesToTasks.findFirst({
        where: eq(mongoDatabasesToTasks.mongoDatabaseId, mongoDatabaseId),
        orderBy: [desc(mongoDatabasesToTasks.createdAt)],
        with: {
            task: {
                with: {
                    associatedMongoDatabases: true,
                    associatedBackupPolicy: true
                }
            }
        }
    });

    return entry?.task;
}

export const isMongoDatabaseBusyWithTask = async (mongoDatabaseId: number) => {
    const latestTask = await tryGetLatestTask(mongoDatabaseId);
    return latestTask && !latestTask.isComplete;
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
        const client = await MongoClient.connect(mongoDatabase.connectionUri, {
            connectTimeoutMS: 2000,
            serverSelectionTimeoutMS: 2000
        });
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

export const startManualBackup = withAuthOrRedirect(async (mongoDatabaseId: number, backupMode: BackupMode) => {
    const result = await TaskRunner.startTask({
        taskType: TaskType.ManualBackup,
        executorClass: MongoBackupTaskExecutor,
        databases: [{
            mongoDatabaseId: mongoDatabaseId,
            involvementReason: 'Performing Backup (Manual)'
        }],
        executorParams: {
            backupMode: backupMode
        }
    });

    return {
        ...result,
        message: (result.success ? "Backup started" : result.message)
    }
});

export const startRestore = withAuthOrRedirect(async (mongoDatabaseId: number, backupId: number) => {
    const result = await TaskRunner.startTask({
        taskType: TaskType.Restore,
        executorClass: MongoRestoreExecutor,
        executorParams: {
            backupId: backupId
        }, 
        databases: [{
            mongoDatabaseId: mongoDatabaseId,
            involvementReason: 'Restoring a backup'
        }]
    });

    return {
        ...result,
        message: (result.success ? "Restore started" : result.message)
    }
});

export const startImport = withAuthOrRedirect(async (mongoDatabaseId: number, importFromMongoDatabaseId: number) => {

    const result = await TaskRunner.startTask({
        taskType: TaskType.Import,
        executorClass: MongoImportExecutor,
        executorParams: {
            importFromMongoDatabaseId: importFromMongoDatabaseId
        },
        databases: [{
            mongoDatabaseId: mongoDatabaseId,
            involvementReason: 'Importing'
        }, {
            mongoDatabaseId: importFromMongoDatabaseId,
            involvementReason: 'Exporting'
        }]
    });

    return {
        ...result,
        message: (result.success ? "Import started" : result.message)
    }
});


export const getAllMongoDatabases = withAuthOrRedirect(async (): Promise<MongoDatabaseCensored[]> => {
    const result = await database.query.mongoDatabases.findMany();
    return result.map(censorMongoDatabase);
});

export const addMongoDatabase = withAuthOrRedirect(async (mongoDatabase: InsertMongoDatabase): Promise<MongoDatabaseCensored> => {
    const insertedEntry = await database.insert(mongoDatabases).values([mongoDatabase]).returning();
    return censorMongoDatabase(insertedEntry[0]);
});

export const deleteMongoDatabase = withAuthOrRedirect(async (id: number, deleteBackups: boolean) => {
    
    const mongoDatatbase = await database.query.mongoDatabases.findFirst({ 
        where: eq(mongoDatabases.id, id),
        with: {
            backups: true,
            associatedTasks: true
        }
    });
    if(!mongoDatatbase) {
        return {
            success: false,
            message: `Mongo Database with id ${id} not found`
        }
    }

    const isBusy = await isMongoDatabaseBusyWithTask(id);

    if(isBusy) {
        return {
            success: false,
            message: `Database is busy with a task, please try again once its current task is complete`
        }
    }

    await database.delete(mongoDatabases).where(eq(mongoDatabases.id, id));
    await database.delete(mongoDatabasesToTasks).where(eq(mongoDatabasesToTasks.mongoDatabaseId, id));
    await database.delete(backupPolicies).where(eq(backupPolicies.mongoDatabaseId, id));

    return {
        success: true,
        message: "Database deleted successfully"
    }
});