import { relations } from "drizzle-orm";
import { integer, sqliteTable, SQLiteUpdateSetSource, text } from "drizzle-orm/sqlite-core";
import { MongoDatabase, mongoDatabases } from "./mongo-database.schema";
import { sqliteStringEnum } from "@backend/utils";
import { BackupMode } from "@backend/tasks/compression.enums";
import { Backup, backups } from "./backup.schema";
import { Task, tasks } from "./task.schema";

export const backupPolicies = sqliteTable('backup_policies', {
    id: integer('id').primaryKey({autoIncrement: true}),
    referenceName: text('reference_name').notNull().default("Backup Policy"),
    mongoDatabaseId: integer('mongo_database_id').notNull(),
    activeTaskId: integer('active_task_id'),
    backupIntervalCron: text('backup_interval_cron').notNull(),
    backupRetentionDays: integer('backup_retention_days').notNull(),
    backupMode: text('backup_mode', sqliteStringEnum(BackupMode)).notNull().$type<BackupMode>(),
    lastBackupAt: integer('last_backup_at', {mode: 'timestamp'}),
    nextBackupAt: integer('next_backup_at', {mode: 'timestamp'}),
    createdAt: integer('created_at', {mode: 'timestamp'}).notNull().$default(() => new Date()),
});

export const backupPoliciesRelations = relations(backupPolicies, ({ one, many}) => ({
    mongoDatabase: one(mongoDatabases, {
        fields: [backupPolicies.mongoDatabaseId],
        references: [mongoDatabases.id]
    }),
    backups: many(backups),
    activeTask: one(tasks, {
        fields: [backupPolicies.activeTaskId],
        references: [tasks.id]
    }),
}));

export type BackupPolicy = typeof backupPolicies.$inferSelect;
export type InsertBackupPolicy = typeof backupPolicies.$inferInsert;
export type UpdateBackupPolicy = SQLiteUpdateSetSource<typeof backupPolicies>
export type BackupPolicyWithRelations = BackupPolicy & { 
    mongoDatabase: MongoDatabase,
    backups: Backup[],
    activeTask: Task | null 
};