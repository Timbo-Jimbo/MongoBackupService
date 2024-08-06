import { sqliteStringEnum } from "@backend/utils";
import { integer, sqliteTable, SQLiteUpdateSetSource, text } from "drizzle-orm/sqlite-core";

export enum TaskCompletionType {
    NotComplete = 'not-complete',
    Sucessful = 'successful',
    Error = 'error',
    Cancelled = 'cancelled'
}

export enum TaskType {
    ScheduledBackup = 'scheduled_backup',
    ManualBackup = 'manual_backup',
    Restore = 'restore',
    Seed = 'seed',
    DeleteBackup = 'delete_backup'
}

export interface TaskUncertainProgressMeta 
{
    message: string;
    hasProgressValues: false;
}

export interface TaskDetailedProgressMeta {
    message: string;
    hasProgressValues: true;
    current: number;
    total: number;
    countedThingName: string;
}

export type TaskProgressMeta = TaskUncertainProgressMeta | TaskDetailedProgressMeta;

export const tasks = sqliteTable('tasks', {
    id: integer('id').primaryKey({autoIncrement: true}),
    mongoDatabaseId: integer('mongo_database_id'),
    type: text('type', { enum: sqliteStringEnum(TaskType) }).notNull(),
    isComplete: integer('is_complete', {mode: 'boolean'}).notNull().default(false),
    completionType: text('completion_type', { enum: sqliteStringEnum(TaskCompletionType) }).notNull().default(TaskCompletionType.NotComplete),
    canBeCancelled: integer('can_be_cancelled', {mode: 'boolean'}).notNull().default(false),
    cancelRequested: integer('cancel_requested', {mode: 'boolean'}).notNull().default(false),
    progress: text('progress', {mode: 'json'}).$type<TaskProgressMeta>().default({hasProgressValues: false, message: "Initialising"}),
    startedAt: integer('started_at', {mode: 'timestamp'}).notNull().$default(() => new Date()),
    updatedAt: integer('updated_at', {mode: 'timestamp'}).notNull().$default(() => new Date()).$onUpdate(() => new Date()),
    completedAt: integer('completed_at', {mode: 'timestamp'}),
});

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;
export type UpdateTask = SQLiteUpdateSetSource<typeof tasks>