import { sqliteStringEnum } from "@backend/utils";
import { relations } from "drizzle-orm";
import { integer, sqliteTable, SQLiteUpdateSetSource, text } from "drizzle-orm/sqlite-core";
import { mongoDatabases } from "./mongodb-database.schema";

export enum ResolvedTaskState {
    Sucessful = 'successful',
    Error = 'error',
    Cancelled = 'cancelled'
}

export enum PendingTaskState {
    Running = 'running',
}

export type TaskState = ResolvedTaskState | PendingTaskState;
export const TaskState = {...ResolvedTaskState, ...PendingTaskState};

export enum TaskType {
    ScheduledBackup = 'scheduled_backup',
    ManualBackup = 'manual_backup',
    Restore = 'restore',
    Import = 'import',
}

export interface TaskUncertainProgress 
{
    message: string;
    hasProgressValues: false;
}

export interface TaskDetailedProgress {
    message: string;
    hasProgressValues: true;
    current: number;
    total: number;
    countedThingName: string;
}

export enum TaskCancellationType
{
    NotCancellable = 'not_cancellable',
    SafeToCancel = 'safe_to_cancel',
    DangerousToCancel = 'dangerous_to_cancel',
}

export type TaskProgress = TaskUncertainProgress | TaskDetailedProgress;

export const tasks = sqliteTable('tasks', {
    id: integer('id').primaryKey({autoIncrement: true}),
    mongoDatabaseId: integer('mongo_database_id').notNull(),
    type: text('type', { enum: sqliteStringEnum(TaskType) }).notNull(),
    isComplete: integer('is_complete', {mode: 'boolean'}).notNull().default(false),
    state: text('state', { enum: sqliteStringEnum(TaskState) }).notNull().default(TaskState.Running),
    cancellationType: text('cancellation_type', { enum: sqliteStringEnum(TaskCancellationType) }).notNull().default(TaskCancellationType.NotCancellable),
    cancelRequested: integer('cancel_requested', {mode: 'boolean'}).notNull().default(false),
    progress: text('progress', {mode: 'json'}).$type<TaskProgress>(),
    startedAt: integer('started_at', {mode: 'timestamp'}).notNull().$default(() => new Date()),
    updatedAt: integer('updated_at', {mode: 'timestamp'}).notNull().$default(() => new Date()).$onUpdate(() => new Date()),
    completedAt: integer('completed_at', {mode: 'timestamp'})
});


export const tasksRelations = relations(tasks, ({ one }) => ({
    mongoDatabase: one(mongoDatabases, {
        fields: [tasks.mongoDatabaseId],
        references: [mongoDatabases.id]
    }),
}));

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;
export type UpdateTask = SQLiteUpdateSetSource<typeof tasks>