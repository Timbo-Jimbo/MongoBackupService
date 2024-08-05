import { relations } from "drizzle-orm";
import { integer, sqliteTable, SQLiteUpdateSetSource, text } from "drizzle-orm/sqlite-core";
import { mongoDatabases } from "./mongodb-database.schema";

export enum TaskStatus {
    Running = 'running',
    Completed = 'completed',
    Failed = 'failed'
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
    type: text('type', { enum: [TaskType.ScheduledBackup, TaskType.ManualBackup, TaskType.Restore, TaskType.Seed, TaskType.DeleteBackup] }).notNull(),
    status: text('status', { enum: [TaskStatus.Running, TaskStatus.Completed, TaskStatus.Failed] }).notNull().default(TaskStatus.Running),
    progress: text('progress', {mode: 'json'}).$type<TaskProgressMeta>().default({hasProgressValues: false, message: "Initialising"}),
    startedAt: integer('started_at', {mode: 'timestamp'}).notNull().$default(() => new Date()),
    updatedAt: integer('updated_at', {mode: 'timestamp'}).notNull().$default(() => new Date()).$onUpdate(() => new Date()),
    completedAt: integer('completed_at', {mode: 'timestamp'}),
});

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;
export type UpdateTask = SQLiteUpdateSetSource<typeof tasks>

export const tasksRelations = relations(tasks, ({ one }) => ({
    mongoDatabase: one(mongoDatabases, {
        fields: [tasks.mongoDatabaseId],
        references: [mongoDatabases.id]
    }),
}));