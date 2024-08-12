"use client"

import { createContext, useContext, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Backup } from "@backend/db/backup.schema";
import { getAllBackups, getAllBackupsForDatabase, getAvailableBackupModes } from "@actions/backups";
import useLocalStorageState from "use-local-storage-state";

type QueryListEntry = Backup;

const createBackupListQueryClient = (mongoDatabaseId: number | undefined) => {

    const queryKey = [`backups-${mongoDatabaseId !== undefined ? `mdb_${mongoDatabaseId}` : 'all'}`];

    const [skeletons, setSkeletonCount] = useLocalStorageState<number>(`${queryKey[0]}-skeletons`, {
        defaultValue: 0,
    });

    const queryClient = useQueryClient();
    const getAllQuery = useQuery({
        queryKey: queryKey,
        queryFn: async () => {
            const allBackups = await (mongoDatabaseId !== undefined ? getAllBackupsForDatabase(mongoDatabaseId) : getAllBackups());
            setSkeletonCount(allBackups?.length ?? 0);
            return allBackups ?? [];
        },
    });

    const availableBackupModesQuery = useQuery({
        queryKey: ["backup-modes"],
        queryFn: async () => {
            return await getAvailableBackupModes();
        }
    });

    const notifyBackupWasDeleted = (backupId: number) => {
        queryClient.setQueryData(queryKey, (entries: QueryListEntry[]): QueryListEntry[] => {
            const newEntries = entries.filter(entry => entry.id !== backupId);
            setSkeletonCount(newEntries.length);
            return newEntries;
        });
    };

    const notifyBackupsPotentiallyDirty = () => {
        queryClient.invalidateQueries({
            queryKey: queryKey,
            exact: false
        });
    }

    return {
        queryKey,
        getAllQuery,
        availableBackupModesQuery,
        notifyBackupWasDeleted,
        notifyBackupsPotentiallyDirty,
        skeletonCount: skeletons
    }
}

type BackupListQueryClientContextValue = ReturnType<typeof createBackupListQueryClient>;
const BackupListQueryClient = createContext<BackupListQueryClientContextValue | null>(null);

export const BackupListQueryClientProvider = ({
    databaseId,
    children
}: {
    databaseId?: number | undefined,
    children: React.ReactNode
}) => {
    const value = createBackupListQueryClient(databaseId);
    return ( 
        <BackupListQueryClient.Provider value={value}>
            {children}
        </BackupListQueryClient.Provider>
    );
}

export const tryUseBackupListQueryClient = () => {
    return useContext(BackupListQueryClient);
}

export const useBackupListQueryClient = () => {
    const value = tryUseBackupListQueryClient();
    if(!value) throw new Error(`${useBackupListQueryClient.name} must be used within a ${BackupListQueryClientProvider.name}`);
    return value;
}
