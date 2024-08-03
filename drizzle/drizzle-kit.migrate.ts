import { } from "drizzle-kit"
import { database } from "@backend/db/database.service";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

migrate(database, {
    migrationsFolder: "drizzle/migrations",
});