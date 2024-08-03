'use server'

import { database } from "@backend/db/database.service";
import { withAuthOrRedirect } from "./common"
import { InsertTask, tasks, TaskStatus, TaskType } from "@backend/db/task.schema";
import { eq } from "drizzle-orm";

export const getAllTasks = withAuthOrRedirect(async () => {
    return await database.query.tasks.findMany();
});

export const addRandomTask = withAuthOrRedirect(async () => {

    return (await database.insert(tasks).values({
        type: TaskType.Backup,
        latestUpdate: "Backup the database, a fake task!",
        status: TaskStatus.Pending,
    }).returning())[0];
});

export const updateTask = withAuthOrRedirect(async (id: number, update: Partial<InsertTask>) => {
    const result = await database.update(tasks).set(update).where(eq(tasks.id, id)).returning();
    return result[0];
});

export const deleteTask = withAuthOrRedirect(async (id: number) => {
    await database.delete(tasks).where(eq(tasks.id, id)).execute();
});