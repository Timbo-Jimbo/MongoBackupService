import { relations } from "drizzle-orm";
import { mongoDatabases } from "./mongodb-database.schema";
import { tasks } from "./task.schema";

export const tasksRelations = relations(tasks, ({ one }) => ({
    mongoDatabase: one(mongoDatabases, {
        fields: [tasks.mongoDatabaseId],
        references: [mongoDatabases.id]
    }),
}));
