"use client"

import { createContext, useContext } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Backup } from "@backend/db/backup.schema";
import { getAllBackups, getAllBackupsForDatabase } from "@actions/backups";

type QueryListEntry = Backup;

const createBackupListQueryClient = (mongoDatabaseId: number | undefined) => {

    const queryClient = useQueryClient();
    const queryKey = ["backups"];

    const getAllQuery = useQuery({
        queryKey: queryKey,
        queryFn: async () => {
            const allBackups = await (mongoDatabaseId !== undefined ? getAllBackupsForDatabase(mongoDatabaseId) : getAllBackups());
            return allBackups ?? [];
        },
    });

    const notifyBackupWasDeleted = (backupId: number) => {
        queryClient.setQueryData(queryKey, (entries: QueryListEntry[]): QueryListEntry[] => {
            return entries.filter(entry => entry.id !== backupId);
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
        notifyBackupWasDeleted,
        notifyBackupsPotentiallyDirty
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
