import { Relation, relations } from "drizzle-orm";
import { integer, sqliteTable, SQLiteUpdateSetSource, text } from "drizzle-orm/sqlite-core";
import { MongoDatabase, mongoDatabases } from "./mongo-database.schema";
import { sqliteStringEnum } from "@backend/utils";
import { BackupCompressionFormat, BackupMode } from "@backend/tasks/compression.enums";
import { backupPolicies, BackupPolicy } from "./backup-policy.schema";

export type BackupSourceMetadata = {
    databaseName: string;
    collections: {
        collectionName: string;
        documentCount: number;
    }[];
}

export const backups = sqliteTable('backups', {
    id: integer('id').primaryKey({autoIncrement: true}),
    mongoDatabaseId: integer('mongo_database_id'),
    backupPolicyId: integer('backup_policy_id'),
    sourceMetadata: text('source_metadata', {mode: 'json'}).notNull().$type<BackupSourceMetadata>(),
    format: text('format', sqliteStringEnum(BackupCompressionFormat)).notNull().$type<BackupCompressionFormat>(),
    mode: text('mode', sqliteStringEnum(BackupMode)).notNull().$type<BackupMode>(),
    archivePath: text('archive_path').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    startedAt: integer('started_at', {mode: 'timestamp'}).notNull().$default(() => new Date()),
    finishedAt: integer('finished_at', {mode: 'timestamp'}).notNull().$default(() => new Date()),
});

export const backupsRelations = relations(backups, ({ one }) => ({
    mongoDatabase: one(mongoDatabases, {
        fields: [backups.mongoDatabaseId],
        references: [mongoDatabases.id]
    }),
    backupPolicy: one(backupPolicies, {
        fields: [backups.backupPolicyId],
        references: [backupPolicies.id]
    }),
}));

export type Backup = typeof backups.$inferSelect;
export type InsertBackup = typeof backups.$inferInsert;
export type UpdateBackup = SQLiteUpdateSetSource<typeof backups>