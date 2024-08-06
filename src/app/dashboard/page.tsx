'use client'

import { LogoutButton } from "@app/login/components"
import { TaskList } from "./task-list"
import { MongoDatabaseList } from "./mongo-database-list";
import { BackupList } from "./backup-list";
import { createContext, useCallback, useContext, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getBackupStats } from "@actions/backups";
import { getAllMongoDatabases, addMongoDatabase } from "@actions/mongo";
import { DatabaseBackupSummary } from "@backend/db/backup.schema";
import { MongoDatabaseCensored, InsertMongoDatabase } from "@backend/db/mongodb-database.schema";

type QueryListEntry = {
  mongoDatabase: MongoDatabaseCensored,
  backupSummary: DatabaseBackupSummary
}

const CreateMongoDatabaseListQueryClient = () => {
  
  const queryClient = useQueryClient();
  const queryKey = ["mongo-databases-with-backup-summary"];

  const getAllQuery = useQuery({
    queryKey: queryKey,
    queryFn: async () => {
      const mongoDatabases = await getAllMongoDatabases();
      if(!mongoDatabases) return [];
      const backupStats = await Promise.all(mongoDatabases.map(db => getBackupStats(db.id)));
      return mongoDatabases.map((db, index) => {
        return {
          mongoDatabase: db,
          backupSummary: backupStats[index] ?? { count: 0 }
        } as QueryListEntry;
      });
    },
  });

  const notifyDatabaseWasDeleted = (databaseId: number) => {
    queryClient.setQueryData(queryKey, (entries: QueryListEntry[]) => {
      return entries.filter(entry => entry.mongoDatabase.id !== databaseId);
    });
  };

  const addDatabaseMutation = useMutation({
    mutationFn: async (mongoDatabase: InsertMongoDatabase) => {
      const newDatabase = await addMongoDatabase(mongoDatabase);
      return {
        mongoDatabase: newDatabase,
        backupSummary: { count: 0 }
      } as QueryListEntry;
    },
    onSuccess: (newEntry) => {

      if(!newEntry) return;

      queryClient.setQueryData(queryKey, (entries: QueryListEntry[]) => {
        return [...entries, newEntry];
      });
    }
  })

  return {
    queryKey,
    getAllQuery,
    addDatabaseMutation,
    notifyDatabaseWasDeleted
  }
}

type MongoDatabaseListQueryClientContextValue = ReturnType<typeof CreateMongoDatabaseListQueryClient>;
const MongoDatabaseListQueryClient = createContext<MongoDatabaseListQueryClientContextValue | null>(null);

const MongoDatabaseListQueryClientProvider = ({children}: {children: React.ReactNode}) => {
  const value = CreateMongoDatabaseListQueryClient();
  return <MongoDatabaseListQueryClient.Provider value={value}>{children}</MongoDatabaseListQueryClient.Provider>
}

export const useMongoDatabaseListQueryClient = () => {
  const value = useContext(MongoDatabaseListQueryClient);
  if(!value) throw new Error("useMongoDatabaseListQueryClient must be used within a MongoDatabaseListQueryClientProvider");
  return value;
}

export default function DashboardPage() {

  return (
      <MongoDatabaseListQueryClientProvider>
        <main className="flex min-h-screen flex-col place-items-center justify-center p-24">
          
          <div className="flex flex-col place-items-center gap-8 w-full max-w-3xl">
            <div className="flex flex-col w-full gap-4">
              <h1>Welcome back!</h1>
              <LogoutButton />
            </div>
            <MongoDatabaseList/>
            <BackupList/>
            <TaskList/>
          </div>
        </main>
      </MongoDatabaseListQueryClientProvider>
  );
}
