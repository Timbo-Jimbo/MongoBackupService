import { relations } from "drizzle-orm";
import { integer, sqliteTable, SQLiteUpdateSetSource, text } from "drizzle-orm/sqlite-core";
import { mongoDatabases } from "./mongodb-database.schema";

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
    sourceMetadata: text('source_metadata', {mode: 'json'}).notNull().$type<BackupSourceMetadata>(),
    archivePath: text('archive_path').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    createdAt: integer('created_at', {mode: 'timestamp'}).notNull().$default(() => new Date()),
});

export const backupsRelations = relations(backups, ({ one }) => ({
    mongoDatabase: one(mongoDatabases, {
        fields: [backups.mongoDatabaseId],
        references: [mongoDatabases.id]
    }),
}));

export type Backup = typeof backups.$inferSelect;
export type InsertBackup = typeof backups.$inferInsert;
export type UpdateBackup = SQLiteUpdateSetSource<typeof backups>