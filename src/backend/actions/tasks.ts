'use server'

import { database } from "@backend/db";
import { InsertTask, tasks, TaskWithRelations } from "@backend/db/task.schema";
import { desc, eq, inArray } from "drizzle-orm";
import { withAuthOrRedirect } from "./utils";
import { mongoDatabasesToTasks } from "@backend/db/mongo-databases-to-tasks.schema";

export const getAllTasks = withAuthOrRedirect(async (refreshIds?: number[] | undefined): Promise<TaskWithRelations[]> => {
    
    if(refreshIds) return await database.query.tasks.findMany({ where: inArray(tasks.id, refreshIds), orderBy: [desc(tasks.id)], with: {associatedMongoDatabases: true} });
    return await database.query.tasks.findMany({ orderBy: [desc(tasks.id)], with: { associatedMongoDatabases: true} });
});

export const getAllTasksForDatabase = withAuthOrRedirect(async (mongoDatabaseId: number) => {
    return (await database.query.mongoDatabasesToTasks.findMany({
        where: eq(mongoDatabasesToTasks.mongoDatabaseId, mongoDatabaseId), 
        orderBy: [desc(mongoDatabasesToTasks.createdAt)],
        with: { task: true }
    })).map(x => x.task);
});

export const updateTask = withAuthOrRedirect(async ({id,  update }: {id: number, update: Partial<InsertTask>} ): Promise<TaskWithRelations> => {
    
    await database.update(tasks).set(update).where(eq(tasks.id, id));
    const task = await database.query.tasks.findFirst({ 
        where: eq(tasks.id, id),
        with: { associatedMongoDatabases: true }
    });

    if(!task) throw new Error(`Task with id ${id} not found`);

    return task;
});

export const deleteTask = withAuthOrRedirect(async (id: number) => {
    await database.delete(tasks).where(eq(tasks.id, id));
    return { success: true, message: `Cleared task` };
});

export const deleteAllCompletedTasks = withAuthOrRedirect(async () => {
    const result = await database.delete(tasks).where(eq(tasks.isComplete, true)).returning();
    return { 
        success: true, 
        message: `Cleared all completed tasks`,
        clearedTaskIds: result.map(x => x.id)
    };
});