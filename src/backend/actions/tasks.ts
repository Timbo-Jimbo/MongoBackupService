'use server'

import { database } from "@backend/db";
import { InsertTask, tasks, TaskWithRelations } from "@backend/db/task.schema";
import { desc, eq, inArray } from "drizzle-orm";
import { withAuthOrRedirect } from "./utils";
import { mongoDatabasesToTasks } from "@backend/db/mongo-databases-to-tasks.schema";
import { backupPolicies } from "@backend/db/backup-policy.schema";

export const getAllTasks = withAuthOrRedirect(async (refreshIds?: number[] | undefined): Promise<TaskWithRelations[]> => {
    
    if(refreshIds) return await database.query.tasks.findMany({ where: inArray(tasks.id, refreshIds), orderBy: [desc(tasks.id)], with: {associatedMongoDatabases: true, associatedBackupPolicy: true} });
    return await database.query.tasks.findMany({ orderBy: [desc(tasks.id)], with: { associatedMongoDatabases: true, associatedBackupPolicy: true} });
});

export const getAllTasksForDatabase = withAuthOrRedirect(async (mongoDatabaseId: number) => {
    return (await database.query.mongoDatabasesToTasks.findMany({
        where: eq(mongoDatabasesToTasks.mongoDatabaseId, mongoDatabaseId), 
        orderBy: [desc(mongoDatabasesToTasks.createdAt)],
        with: { 
            task: {
                with: {
                    associatedMongoDatabases: true,
                    associatedBackupPolicy: true,
                }
            }
        }
    })).map(x => x.task);
});

export const updateTask = withAuthOrRedirect(async ({id,  update }: {id: number, update: Partial<InsertTask>} ): Promise<TaskWithRelations> => {
    
    await database.update(tasks).set(update).where(eq(tasks.id, id));
    const task = await database.query.tasks.findFirst({ 
        where: eq(tasks.id, id),
        with: { 
            associatedMongoDatabases: true,
            associatedBackupPolicy: true
        }
    });

    if(!task) throw new Error(`Task with id ${id} not found`);

    return task;
});

export const deleteTask = withAuthOrRedirect(async (id: number) => {

    await database.delete(tasks).where(eq(tasks.id, id));
    await database.delete(mongoDatabasesToTasks).where(eq(mongoDatabasesToTasks.taskId, id));
    await database.update(backupPolicies).set({ activeTaskId: null }).where(eq(backupPolicies.activeTaskId, id));

    return { success: true, message: `Cleared task` };
});

export const deleteAllCompletedTasks = withAuthOrRedirect(async () => {
    
    const allCompletedTasks = await database.query.tasks.findMany({ where: eq(tasks.isComplete, true) });
    if(allCompletedTasks.length === 0) return { success: true, message: `No tasks to clear`, clearedTaskIds: [] };

    await database.delete(tasks).where(eq(tasks.isComplete, true));
    await database.delete(mongoDatabasesToTasks).where(inArray(mongoDatabasesToTasks.taskId, allCompletedTasks.map(x => x.id)));
    await database.update(backupPolicies).set({ activeTaskId: null }).where(inArray(backupPolicies.activeTaskId, allCompletedTasks.map(x => x.id)));

    return { 
        success: true, 
        message: `Cleared all completed tasks`,
        clearedTaskIds: allCompletedTasks.map(x => x.id)
    };
});