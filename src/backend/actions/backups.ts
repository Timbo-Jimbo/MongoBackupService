'use server'

import { database } from "@backend/db";
import { desc, eq } from "drizzle-orm";
import { withAuthOrRedirect } from "./utils";
import { backups } from "@backend/db/backup.schema";
import { Compression } from "@backend/tasks/mongo-utils";
import { TaskRunner } from "@backend/tasks/task-runner";
import { MongoDeleteBackupExecutor } from "@backend/tasks/mongo-delete-backup";
import { TaskType } from "@backend/db/task.schema";

export const getAllBackups = withAuthOrRedirect(async () => {
    return await database.query.backups.findMany({ 
        orderBy: [desc(backups.id)],
        with: { 
            mongoDatabase: true,
            backupPolicy: true
        }
    });
});

export const getAllBackupsForDatabase = withAuthOrRedirect(async (mongoDatabaseId: number) => {
    return await database.query.backups.findMany({
        where: eq(backups.mongoDatabaseId, mongoDatabaseId), 
        orderBy: [desc(backups.id)],
        with: { 
            mongoDatabase: true,
            backupPolicy: true
        }
    });
});

export const startDeleteBackupTask = withAuthOrRedirect(async (id: number) => {
    
    const taskId = await TaskRunner.startTask({
        executorClass: MongoDeleteBackupExecutor,
        executorParams: { backupIdsToDelete: [id] },
        taskType: TaskType.DeleteBackup,
    });

    return {
        success: true,
        message: `Backup deletion task started`,
        taskId: taskId
    }
});

export const getAvailableBackupModes = withAuthOrRedirect(async () => {
    return await Compression.determineAvailableModes();
});