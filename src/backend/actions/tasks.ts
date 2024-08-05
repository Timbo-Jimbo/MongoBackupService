'use server'

import { database } from "@backend/db";
import { withAuthOrRedirect } from "./common"
import { InsertTask, tasks } from "@backend/db/task.schema";
import { desc, eq, inArray } from "drizzle-orm";

export const getAllTasks = withAuthOrRedirect(async (refreshIds?: number[] | undefined) => {
    
    if(refreshIds) return await database.query.tasks.findMany({ where: inArray(tasks.id, refreshIds), orderBy: [desc(tasks.id)] });
    return await database.query.tasks.findMany({ orderBy: [desc(tasks.id)] });
});

export const updateTask = withAuthOrRedirect(async ({id,  update }: {id: number, update: Partial<InsertTask>} ) => {
    const result = await database.update(tasks).set(update).where(eq(tasks.id, id)).returning();
    return result[0];
});

export const deleteTask = withAuthOrRedirect(async (id: number) => {
    await database.delete(tasks).where(eq(tasks.id, id)).execute();
});