"use client"

import { createContext, useContext } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAllBackupsForDatabase } from "@actions/backups";
import { getAllMongoDatabases, addMongoDatabase, tryGetLatestTask } from "@actions/mongo";
import { Backup } from "@backend/db/backup.schema";
import { MongoDatabaseCensored, InsertMongoDatabase } from "@backend/db/mongo-database.schema";
import { TaskWithRelations } from "@backend/db/task.schema";
import useLocalStorageState from "use-local-storage-state"

type QueryListEntry = {
    mongoDatabase: MongoDatabaseCensored,
    backups: Backup[],
    latestTask?: TaskWithRelations
}

const createMongoDatabaseListQueryClient = () => {

    const queryClient = useQueryClient();
    const queryKey = ["backups", "mongo-databases", "tasks", "backup-policies"];

    const [skeletons, setSkeletonCount] = useLocalStorageState<number>("mongo-database-skeletons", {
        defaultValue: 0,
    });

    const getAllQuery = useQuery({
        queryKey: queryKey,
        queryFn: async () => {
            const mongoDatabases = await getAllMongoDatabases();
            if(!mongoDatabases) return [];
            const backupsPerDb = await Promise.all(mongoDatabases.map(db => getAllBackupsForDatabase(db.id)));
            const latestTasksPerDb = await Promise.all(mongoDatabases.map(db => tryGetLatestTask(db.id)));

            setSkeletonCount(mongoDatabases.length);

            return mongoDatabases.map((db, index) => {
                return {
                    mongoDatabase: db,
                    backups: backupsPerDb[index] ?? [],
                    latestTask: latestTasksPerDb[index]
                } as QueryListEntry;
            });
        },
    });

    const notifyDatabaseWasDeleted = (databaseId: number) => {
        queryClient.setQueryData(queryKey, (entries: QueryListEntry[]) => {
            const newEntries = entries.filter(entry => entry.mongoDatabase.id !== databaseId);
            setSkeletonCount(newEntries.length);
            return newEntries;
        });
    };

    const addDatabaseMutation = useMutation({
        mutationFn: async (mongoDatabase: InsertMongoDatabase) => {
            const newDatabase = await addMongoDatabase(mongoDatabase);
            return {
                mongoDatabase: newDatabase,
                backups: [],
                backupPolicies: [],
            } as QueryListEntry;
        },
        onSuccess: (newEntry) => {
            if(!newEntry) return;

            queryClient.setQueryData(queryKey, (entries: QueryListEntry[]) => {
                const newEntries = [...entries, newEntry];
                setSkeletonCount(newEntries.length);
                return newEntries;
            });
        }
    })

    const notifyDatabasesPotentiallyDirty = () => {
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
        notifyDatabasesPotentiallyDirty,
        skeletonCount: skeletons
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
