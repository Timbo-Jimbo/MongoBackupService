'use server'

import { database } from "@backend/db";
import { InsertTask, tasks, TaskWithInvolvements } from "@backend/db/task.schema";
import { desc, eq, inArray } from "drizzle-orm";
import { withAuthOrRedirect } from "./utils";
import { mongoDatabaseTaskInvolvements } from "@backend/db/mongo-database-task-involvement.schema";

export const getAllTasks = withAuthOrRedirect(async (refreshIds?: number[] | undefined): Promise<TaskWithInvolvements[]> => {
    
    if(refreshIds) return await database.query.tasks.findMany({ where: inArray(tasks.id, refreshIds), orderBy: [desc(tasks.id)], with: {involvements: true} });
    return await database.query.tasks.findMany({ orderBy: [desc(tasks.id)], with: { involvements: true} });
});

export const getAllTasksForDatabase = withAuthOrRedirect(async (mongoDatabaseId: number) => {
    return (await database.query.mongoDatabaseTaskInvolvements.findMany({
        where: eq(mongoDatabaseTaskInvolvements.mongoDatabaseId, mongoDatabaseId), 
        orderBy: [desc(mongoDatabaseTaskInvolvements.createdAt)],
        with: { task: true }
    })).map(x => x.task);
});

export const updateTask = withAuthOrRedirect(async ({id,  update }: {id: number, update: Partial<InsertTask>} ): Promise<TaskWithInvolvements> => {
    
    await database.update(tasks).set(update).where(eq(tasks.id, id));
    const task = await database.query.tasks.findFirst({ 
        where: eq(tasks.id, id),
        with: { involvements: true }
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