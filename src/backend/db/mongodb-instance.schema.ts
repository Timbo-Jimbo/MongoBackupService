import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export type ColorRgb = {
    r: number;
    g: number;
    b: number;
}

export const mongoDatabases = sqliteTable('mongo_databases', {
    id: integer('id').primaryKey({autoIncrement: true}),
    createdAT: integer('created_at', {mode: 'timestamp'}).notNull().$default(() => new Date()),
    updatedAt: integer('updated_at', {mode: 'timestamp'}).notNull().$default(() => new Date()).$onUpdate(() => new Date()),
    referenceName: text('reference_name').notNull(),
    referenceColor: text('reference_color_hex').notNull().default("#000000"),
    connectionUri: text('connection_uri').notNull(),
    databaseName: text('database_name').notNull(),
});

export enum MongoDatabaseConnection {
    Online = "Online",
    DatabaseMissing = "Database Missing",
    Offline = "Offline",
}

export type MongoDatabase = typeof mongoDatabases.$inferSelect;
export type MongoDatabaseCensored = Omit<MongoDatabase, "connectionUri"> &  { censoredConnectionUri: string };
export type InsertMongoDatabase = typeof mongoDatabases.$inferInsert;
