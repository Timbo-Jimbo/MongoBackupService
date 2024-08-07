'use server'

import { database } from "@backend/db";
import { desc, eq } from "drizzle-orm";
import { withAuthOrRedirect } from "./utils";
import { backups, DatabaseBackupSummary } from "@backend/db/backup.schema";
import { unlinkSync } from "node:fs";

export const getBackupStats = withAuthOrRedirect(async (mongoDatabaseId: number): Promise<DatabaseBackupSummary> => {
    const results = await database.query.backups.findMany({ where: eq(backups.mongoDatabaseId, mongoDatabaseId) });

    return {
        count: results.length,
        lastBackupAt: results.length > 0 ? results[0].createdAt : null
    }
});

export const getAllBackups = withAuthOrRedirect(async () => {
    return await database.query.backups.findMany({ orderBy: [desc(backups.id)] });
});

export const getAllBackupsForDatabase = withAuthOrRedirect(async (mongoDatabaseId: number) => {
    return await database.query.backups.findMany({where: eq(backups.mongoDatabaseId, mongoDatabaseId), orderBy: [desc(backups.id)] });
});

export const deleteBackup = withAuthOrRedirect(async (id: number) => {
    const backup = await database.query.backups.findFirst({ where: eq(backups.id, id) });
    if(backup) {
        await database.delete(backups).where(eq(backups.id, id)).execute();
        unlinkSync(backup.archivePath);
        console.log(`Deleted backup ${backup.archivePath}`);
        return { 
            success: true,
            message: `Deleted backup`
        };
    }
    else 
    {
        return { 
            success: false,
            message: `Backup not found`
        };
    }
});