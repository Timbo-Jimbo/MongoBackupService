import createDb from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "fs";
import { tasks } from "./task.schema"

//ensure folder exists for db data
mkdirSync("data/db", {recursive: true });

const betterSqliteDb = createDb("data/db/db.sqlite");

console.log("Creating DB client");
export const database = drizzle(betterSqliteDb, {
    schema: { tasks },
});