"use client"

import { LogoutButton } from "@app/login/components"
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

const createMongoDatabaseListQueryClient = () => {

    const queryClient = useQueryClient();
    const queryKey = ["backups", "mongo-databases"];

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

    const notifyDAtabasesPotentiallyDirty = () => {
        queryClient.invalidateQueries({
            queryKey: queryKey,
            exact: false
        });
    }

    return {
        queryKey,
        getAllQuery,
        addDatabaseMutation,
        notifyDatabaseWasDeleted,
        notifyDAtabasesPotentiallyDirty
    }
}

type MongoDatabaseListQueryClientContextValue = ReturnType<typeof createMongoDatabaseListQueryClient>;
const MongoDatabaseListQueryClient = createContext<MongoDatabaseListQueryClientContextValue | null>(null);

export const MongoDatabaseListQueryClientProvider = ({children}: {children: React.ReactNode}) => {
    const value = createMongoDatabaseListQueryClient();
    return ( 
        <MongoDatabaseListQueryClient.Provider value={value}>
            {children}
        </MongoDatabaseListQueryClient.Provider>
    );
}

export const tryUseMongoDatabaseListQueryClient = () => {
    return useContext(MongoDatabaseListQueryClient);
}


export const useMongoDatabaseListQueryClient = () => {
    const value = tryUseMongoDatabaseListQueryClient();
    if(!value) throw new Error(`${useMongoDatabaseListQueryClient.name} must be used within a ${MongoDatabaseListQueryClientProvider.name}`);
    return value;
}
