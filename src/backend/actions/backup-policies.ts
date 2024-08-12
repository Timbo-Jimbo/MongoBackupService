'use server'

import { database } from "@backend/db";
import { desc, eq } from "drizzle-orm";
import { withAuthOrRedirect } from "./utils";
import { backupPolicies, BackupPolicyWithRelations, InsertBackupPolicy } from "@backend/db/backup-policy.schema";
import { mongoDatabases } from "@backend/db/mongo-database.schema";
import { backups } from "@backend/db/backup.schema";
import { deleteBackup } from "./backups";
import { TaskScheduler } from "@backend/tasks/task-scheduler";
import cronParser from "cron-parser";

export const getAllBackupPoliciesForDatabase = withAuthOrRedirect(async (mongoDatabaseId: number) => {
    return (await database.query.mongoDatabases.findFirst({ 
        where: eq(mongoDatabases.id, mongoDatabaseId), 
        with: { 
            backupPolicies: {
                with: {
                    mongoDatabase: true,
                    backups: true,
                    activeTask: true,
                }
            }
        }
    }))?.backupPolicies || [];
});

export const getAllBackupPolicies = withAuthOrRedirect(async () => {
    return await database.query.backupPolicies.findMany({ 
        orderBy: [desc(backupPolicies.id)],
        with: { 
            mongoDatabase: true,
            backups: true,
            activeTask: true,
        }
     });
});

export const createBackupPolicy = withAuthOrRedirect(async (backupPolicyValues:InsertBackupPolicy) => {

    const interval = cronParser.parseExpression(backupPolicyValues.backupIntervalCron);
    backupPolicyValues.nextBackupAt = interval.hasNext() ? new Date(interval.next().getTime()) : null;
    const [ newPolicy ] =  await database.insert(backupPolicies).values([backupPolicyValues]).returning();
    TaskScheduler.scheduleRun(newPolicy);

    const newPolicyWithRelations = await database.query.backupPolicies.findFirst({
        where: eq(backupPolicies.id, newPolicy.id),
        with: { 
            activeTask: true,
            backups: true,
            mongoDatabase: true
        }
    }) as BackupPolicyWithRelations;

    return {
        success: true,
        message: `Backup Policy Created`,
        backupPolicy: newPolicyWithRelations,
    }
});

export const deleteBackupPolicy = withAuthOrRedirect(async (id: number, deleteBackups: boolean) => {
    
    const backupPolicyToDelete = await database.query.backupPolicies.findFirst({
        where: eq(backupPolicies.id, id),
        with: { backups: true, activeTask: true }
    });

    if(!backupPolicyToDelete)
        return { success: false, message: `Backup Policy not found` };

    if(backupPolicyToDelete.activeTask && !backupPolicyToDelete.activeTask.isComplete)
        return { success: false, message: `Backup Policy is currently running` };

    for(const backup of backupPolicyToDelete.backups) {
        if(deleteBackups)
            await deleteBackup(backup.id);
        else
            await database.update(backups).set({backupPolicyId: null}).where(eq(backups.id, backup.id));
    }
    TaskScheduler.clearScheduledRun(backupPolicyToDelete);
    await database.delete(backupPolicies).where(eq(backupPolicies.id, id));

    return { success: true, message: `Backup Policy Deleted` };
});