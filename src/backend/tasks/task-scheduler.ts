import { backupPolicies, BackupPolicy } from "@backend/db/backup-policy.schema";
import { Backup } from "@backend/db/backup.schema";
import { timeUntilString } from "@lib/utils";
import * as cronParser from "cron-parser"
import { TaskRunner } from "./task-runner";
import { tasks, TaskType } from "@backend/db/task.schema";
import { MongoBackupTaskExecutor } from "./mongo-backup";
import { database } from "@backend/db";
import { eq } from "drizzle-orm";
import { MongoDeleteBackupExecutor } from "./mongo-delete-backup";

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

                console.log(`⏰ Time to run backup policy ${backupPolicy.id}...`);
    
                const refreshedBackupPolicy = await database.query.backupPolicies.findFirst({ 
                    where: eq(backupPolicies.id, backupPolicy.id),
                    with: {
                        activeTask: true,
                        mongoDatabase: {
                            with: {
                                associatedTasks: {
                                    with: {
                                        task: true
                                    }
                                }
                            }
                        }
                    }
                });

                if(!refreshedBackupPolicy)
                {
                    console.log(`Backup policy ${backupPolicy.id} was deleted, skipping scheduled backup task...`);
                    return;   
                }
                
                if(refreshedBackupPolicy.activeTask && !refreshedBackupPolicy.activeTask.isComplete) 
                {
                    console.log(`Backup policy ${backupPolicy.id} is already running, will try to run again later...`);
                    //1 min?
                    setTimeout(() => TaskScheduler.scheduleRun(backupPolicy), 60000); 
                    return;
                }

                if(refreshedBackupPolicy.mongoDatabase && refreshedBackupPolicy.mongoDatabase.associatedTasks.some(association => !association.task.isComplete)) 
                {
                    console.log(`The database associated with backup policy ${backupPolicy.id} is already running a task, will try to run again later...`);
                    //1 min?
                    setTimeout(() => TaskScheduler.scheduleRun(backupPolicy), 60000); 
                    return;
                }

                console.log(`Running backup policy ${backupPolicy.id}...`);

                const startTaskResult = await TaskRunner.startTask({
                    taskType: TaskType.ScheduledBackup,
                    executorClass: MongoBackupTaskExecutor,
                    databases: [{
                        mongoDatabaseId: backupPolicy.mongoDatabaseId,
                        involvementReason: 'Performing Backup (Policy)'
                    }],
                    executorParams: {
                        backupMode: backupPolicy.backupMode,
                        backupPolicy: refreshedBackupPolicy
                    }
                });

                if(startTaskResult.taskId !== undefined)
                {
                    await database.update(backupPolicies).set({
                        activeTaskId: startTaskResult.taskId
                    }).where(eq(backupPolicies.id, backupPolicy.id));
    
                    await database.update(tasks).set({
                        associatedBackupPolicyId: backupPolicy.id
                    }).where(eq(tasks.id, startTaskResult.taskId));
                }

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
        let timeTillDelete = deleteAt.getTime() - new Date().getTime();

        //hack, change to 10 seconds
        timeTillDelete = 10000;

        const intervalId = setTimeout(async () => {

            console.log(`⏰ Time to delete backup ${backup.id}...`); 

            const refreshedBackupPolicy = await database.query.backupPolicies.findFirst({ 
                where: eq(backupPolicies.id, backupPolicy.id),
                with: {
                    activeTask: true,
                    mongoDatabase: true
                }
            });

            if(!refreshedBackupPolicy)
            {
                console.log(`Backup policy ${backupPolicy.id} was deleted, skipping scheduled backup task...`);
                return;   
            }
            
            if(refreshedBackupPolicy.activeTask && !refreshedBackupPolicy.activeTask.isComplete) 
            {
                console.log(`Backup policy ${backupPolicy.id} is already running, will try to run again later...`);
                //1 min?
                setTimeout(() => TaskScheduler.scheduleDelete(backupPolicy, backup), 60000); 
                return;
            }
            
            const startTaskResult = await TaskRunner.startTask({
                executorClass: MongoDeleteBackupExecutor,
                executorParams: {
                    backupIdsToDelete: [backup.id]
                },
                taskType: TaskType.DeleteBackup,
            });

            if(startTaskResult.taskId !== undefined)
            {
                await database.update(backupPolicies).set({
                    activeTaskId: startTaskResult.taskId
                }).where(eq(backupPolicies.id, backupPolicy.id));

                await database.update(tasks).set({
                    associatedBackupPolicyId: backupPolicy.id
                }).where(eq(tasks.id, startTaskResult.taskId));
            }

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