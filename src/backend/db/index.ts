import createDb from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "fs";
import * as taskSchema from "./task.schema"
import * as mongoDatabaseSchema from "./mongo-database.schema";
import * as backupSchema from "./backup.schema";
import * as mongoDatabaseTaskInvolvementsSchema from "./mongo-database-task-involvement.schema";

//ensure folder exists for db data
mkdirSync("data/db", {recursive: true });

const betterSqliteDb = createDb("data/db/db.sqlite");

console.log("Creating DB client");
export const database = drizzle(betterSqliteDb, {
    schema: { ...taskSchema, ...mongoDatabaseSchema, ...backupSchema, ...mongoDatabaseTaskInvolvementsSchema }
});