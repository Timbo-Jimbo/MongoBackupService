import { relations } from "drizzle-orm";
import { integer, sqliteTable, SQLiteUpdateSetSource, text } from "drizzle-orm/sqlite-core";
import { mongoDatabases } from "./mongo-database.schema";
import { tasks } from "./task.schema";

export const mongoDatabasesToTasks = sqliteTable('mongo_databases_to_tasks', {
    id: integer('id').primaryKey({autoIncrement: true}),
    mongoDatabaseId: integer('mongo_database_id').notNull(),
    taskId: integer('task_id').notNull(),
    reason: text('reason').notNull(),
    createdAt: integer('created_at', {mode: 'timestamp'}).notNull().$default(() => new Date()),
});

export const mongoDatabasesToTasksRelations = relations(mongoDatabasesToTasks, ( { one }) => ({
    mongoDatabase: one(mongoDatabases, {
        fields: [mongoDatabasesToTasks.mongoDatabaseId],
        references: [mongoDatabases.id]
    }),
    task: one(tasks, {
        fields: [mongoDatabasesToTasks.taskId],
        references: [tasks.id]
    }),
}));

export type MongoDatabaseToTask = typeof mongoDatabasesToTasks.$inferSelect;
export type InsertMongoDatabaseToTask = typeof mongoDatabasesToTasks.$inferInsert;
export type UpdateMongoDatabaseToTask = SQLiteUpdateSetSource<typeof mongoDatabasesToTasks>