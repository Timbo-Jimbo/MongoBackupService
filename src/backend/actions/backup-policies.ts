'use server'

import { database } from "@backend/db";
import { desc, eq } from "drizzle-orm";
import { withAuthOrRedirect } from "./utils";
import { backupPolicies, InsertBackupPolicy } from "@backend/db/backup-policy.schema";
import { mongoDatabases } from "@backend/db/mongo-database.schema";
import { backups } from "@backend/db/backup.schema";
import { deleteBackup } from "./backups";

export const getAllBackupPoliciesForDatabase = withAuthOrRedirect(async (mongoDatabaseId: number) => {
    return (await database.query.mongoDatabases.findFirst({ where: eq(mongoDatabases.id, mongoDatabaseId), with: { backupPolicies: true } }))?.backupPolicies || [];
});

export const getAllBackupPolicies = withAuthOrRedirect(async () => {
    return await database.query.backupPolicies.findMany({ orderBy: [desc(backupPolicies.id)] });
});

export const createBackupPolicy = withAuthOrRedirect(async (backupPolicyValues:InsertBackupPolicy) => {
    return {
        success: true,
        message: `Backup Policy Created`,
        backupPolicy: await database.insert(backupPolicies).values([backupPolicyValues]).returning().then(x => x[0])
    }
});

export const deleteBackupPolicy = withAuthOrRedirect(async (id: number, deleteBackups: boolean) => {
    
    const backupPolicyToDelete = await database.query.backupPolicies.findFirst({
        where: eq(backupPolicies.id, id),
        with: { backups: true }
    });

    for(const backup of backupPolicyToDelete?.backups || []) {
        if(deleteBackups)
            await deleteBackup(backup.id);
        else
            await database.update(backups).set({backupPolicyId: null}).where(eq(backups.id, backup.id));
    }

    await database.delete(backupPolicies).where(eq(backupPolicies.id, id));

    return { success: true, message: `Backup Policy Deleted` };
});