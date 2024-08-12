import { backupPolicies, BackupPolicy } from "@backend/db/backup-policy.schema";
import { Backup } from "@backend/db/backup.schema";
import { timeUntilString } from "@lib/utils";
import * as cronParser from "cron-parser"
import { TaskRunner } from "./task-runner";
import { TaskType } from "@backend/db/task.schema";
import { MongoBackupTaskExecutor } from "./mongo-backup";
import { deleteBackup } from "@actions/backups";
import { database } from "@backend/db";
import { eq } from "drizzle-orm";
export class TaskScheduler {

    private static backupPolicyIdToScheduledTask: Map<number, NodeJS.Timeout> = new Map();
    private static backupIdToScheduledTask: Map<number, NodeJS.Timeout> = new Map();

    static async scheduleRun(backupPolicy: BackupPolicy) {
        const interval = cronParser.parseExpression(backupPolicy.backupIntervalCron, {
            currentDate: backupPolicy.lastBackupAt ?? backupPolicy.createdAt
        });
        
        TaskScheduler.clearScheduledRun(backupPolicy);

        if(interval.hasNext()) {
            const nextRunDate = interval.next().toDate();
            console.log(`Backup Policy ${backupPolicy.id} is scheduled to run in ${timeUntilString(nextRunDate)} (${interval.next().toDate().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })})`); 
            const timeTillNextRun = nextRunDate.getTime() - new Date().getTime();
            const timeoutId = setTimeout(async () => {


                const refreshedBackupPolicy = await database.query.backupPolicies.findFirst({ where: eq(backupPolicies.id, backupPolicy.id) });
                if(!refreshedBackupPolicy)
                {
                    console.log(`Backup policy ${backupPolicy.id} was deleted, skipping scheduled backup task...`);
                    return;   
                }

                console.log(`Running backup policy ${backupPolicy.id}...`);

                await TaskRunner.startTask({
                    taskType: TaskType.ScheduledBackup,
                    executorClass: MongoBackupTaskExecutor,
                    databases: [{
                        mongoDatabaseId: backupPolicy.mongoDatabaseId,
                        involvementReason: 'Performing Backup (Scheduled)'
                    }],
                    executorParams: {
                        backupMode: backupPolicy.backupMode,
                        backupPolicy: refreshedBackupPolicy
                    }
                });

            }, timeTillNextRun);
            this.backupPolicyIdToScheduledTask.set(backupPolicy.id, timeoutId);
        }
    }

    static async clearScheduledRun(backupPolicy: BackupPolicy) {
        if(this.backupPolicyIdToScheduledTask.has(backupPolicy.id)) {
            console.log(`Clearing scheduled task for backup policy ${backupPolicy.id}`);
            clearTimeout(this.backupPolicyIdToScheduledTask.get(backupPolicy.id)!);
            this.backupPolicyIdToScheduledTask.delete(backupPolicy.id);
        }
    }

    static async scheduleDelete(backupPolicy: BackupPolicy, backup: Backup) {
        
        TaskScheduler.clearScheduledDelete(backup);

        const deleteAt = new Date((backupPolicy.backupRetentionDays * 24 * 60 * 60 * 1000) + backup.finishedAt.getTime())
        console.log(`Backup ${backup.id} is scheduled to be deleted in ${timeUntilString(deleteAt)} (${deleteAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })})`); 
        const timeTillDelete = deleteAt.getTime() - new Date().getTime();
        const intervalId = setTimeout(async () => {

            console.log(`Deleting backup ${backup.id}...`);
            await deleteBackup(backup.id);

        }, timeTillDelete);

        this.backupIdToScheduledTask.set(backup.id, intervalId);
    }

    static async clearScheduledDelete(backup: Backup) {
        if(this.backupIdToScheduledTask.has(backup.id)) {
            console.log(`Clearing scheduled delete for backup ${backup.id}`);
            clearTimeout(this.backupIdToScheduledTask.get(backup.id)!);
            this.backupIdToScheduledTask.delete(backup.id);
        }
    }
}