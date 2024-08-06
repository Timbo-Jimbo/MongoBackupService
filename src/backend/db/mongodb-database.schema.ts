import { relations } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { tasks } from "./task.schema";
import { backups } from "./backup.schema";

export enum MongoDatabaseConnection {
    Online = "Online",
    DatabaseMissing = "Database Missing",
    Offline = "Offline",
}

export interface MongoDatabaseAccess {
    id: number;
    connectionUri: string;
    databaseName: string;
}

export const mongoDatabases = sqliteTable('mongo_databases', {
    id: integer('id').primaryKey({autoIncrement: true}),
    createdAt: integer('created_at', {mode: 'timestamp'}).notNull().$default(() => new Date()),
    updatedAt: integer('updated_at', {mode: 'timestamp'}).notNull().$default(() => new Date()).$onUpdate(() => new Date()),
    referenceName: text('reference_name').notNull(),
    referenceColorHex: text('reference_color_hex').notNull().default("#0394fc"),
    connectionUri: text('connection_uri').notNull(),
    databaseName: text('database_name').notNull(),
});

export const mongoDatabasesRelations = relations(mongoDatabases, ( { many }) => ({
    tasks: many(tasks),
    backups: many(backups),
}));

export type MongoDatabase = typeof mongoDatabases.$inferSelect;
export type MongoDatabaseCensored = Omit<MongoDatabase, "connectionUri"> &  { censoredConnectionUri: string };
export type InsertMongoDatabase = typeof mongoDatabases.$inferInsert;