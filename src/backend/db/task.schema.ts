import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export enum TaskStatus {
    Pending = 'pending',
    Completed = 'completed',
    Cancelled = 'cancelled'
}

export enum TaskType {
    Backup = 'backup',
    Restore = 'restore',
    Seed = 'seed',
    DeleteBackup = 'delete_backup'
}

export const tasks = sqliteTable('tasks', {
    id: integer('id').primaryKey({autoIncrement: true}),
    type: text('type', { enum: [TaskType.Backup, TaskType.Restore, TaskType.Seed, TaskType.DeleteBackup] }).notNull(),
    status: text('status', { enum: [TaskStatus.Pending, TaskStatus.Completed, TaskStatus.Cancelled] }).notNull().default(TaskStatus.Pending),
    progress: integer('progress').notNull().default(0),
    latestUpdate: text('latest-update'),
    startedAt: integer('started_at', {mode: 'timestamp'}).notNull().$default(() => new Date()),
    completedAt: integer('completed_at', {mode: 'timestamp'}),
    updatedAt: integer('updated_at', {mode: 'timestamp'}).notNull().$default(() => new Date()).$onUpdate(() => new Date()),
});

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

