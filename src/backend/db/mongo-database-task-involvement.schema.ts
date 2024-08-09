import { relations } from "drizzle-orm";
import { integer, sqliteTable, SQLiteUpdateSetSource, text } from "drizzle-orm/sqlite-core";
import { mongoDatabases } from "./mongo-database.schema";
import { tasks } from "./task.schema";

export const mongoDatabaseTaskInvolvements = sqliteTable('mongo_database_task_involvements', {
    id: integer('id').primaryKey({autoIncrement: true}),
    mongoDatabaseId: integer('mongo_database_id').notNull(),
    taskId: integer('task_id').notNull(),
    reason: text('reason').notNull(),
    createdAt: integer('created_at', {mode: 'timestamp'}).notNull().$default(() => new Date()),
});

export const mongoDatabaseTaskInvolvementsRelations = relations(mongoDatabaseTaskInvolvements, ( { one }) => ({
    mongoDatabase: one(mongoDatabases, {
        fields: [mongoDatabaseTaskInvolvements.mongoDatabaseId],
        references: [mongoDatabases.id]
    }),
    task: one(tasks, {
        fields: [mongoDatabaseTaskInvolvements.taskId],
        references: [tasks.id]
    }),
}));

export type MongoDatabaseTaskInvolvement = typeof mongoDatabaseTaskInvolvements.$inferSelect;
export type InsertMongoDatabaseTaskInvolvement = typeof mongoDatabaseTaskInvolvements.$inferInsert;
export type UpdateMongoDatabaseTaskInvolvement = SQLiteUpdateSetSource<typeof mongoDatabaseTaskInvolvements>