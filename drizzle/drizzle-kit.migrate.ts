import { } from "drizzle-kit"
import { database } from "@backend/db";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

migrate(database, {
    migrationsFolder: "drizzle/migrations",
});