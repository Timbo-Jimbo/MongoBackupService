"use client"

import { createContext, useContext, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import useLocalStorageState from "use-local-storage-state";
import { BackupPolicyWithRelations } from "@backend/db/backup-policy.schema";
import { getAllBackupPolicies, getAllBackupPoliciesForDatabase } from "@actions/backup-policies";

type QueryListEntry = BackupPolicyWithRelations;

const createBackupPoliciesListQueryClient = (mongoDatabaseId: number | undefined) => {

    const queryKey = ['backup-policies', `backup-policies-${mongoDatabaseId !== undefined ? `mdb_${mongoDatabaseId}` : 'all'}`];

    const [skeletons, setSkeletonCount] = useLocalStorageState<number>(`${queryKey[1]}-skeletons`, {
        defaultValue: 0,
    });

    const queryClient = useQueryClient();
    const getAllQuery = useQuery({
        queryKey: queryKey,
        queryFn: async () => {
            const allPolicies = await (mongoDatabaseId !== undefined ? getAllBackupPoliciesForDatabase(mongoDatabaseId) : getAllBackupPolicies());
            setSkeletonCount(allPolicies?.length ?? 0);
            return allPolicies ?? [];
        },
        refetchInterval: (query) =>{
            const timeUntilNextBackup = query.state.data?.reduce((soonestTimeUntilBackup, policy) => {
                if(!policy.nextBackupAt) return soonestTimeUntilBackup;
                const next = (new Date(policy.nextBackupAt)).getTime();
                const timeUntilNext = next - Date.now();
                return (soonestTimeUntilBackup === undefined || timeUntilNext < soonestTimeUntilBackup) ? timeUntilNext : soonestTimeUntilBackup;
            }, undefined as number | undefined);

            return timeUntilNextBackup === undefined ? false : timeUntilNextBackup;
        }
    });

    const notifyBackupPolicyWasAdded = (policy: BackupPolicyWithRelations) => {
        queryClient.setQueryData(queryKey, (entries: QueryListEntry[]): QueryListEntry[] => {
            const newEntries = [...entries, policy];
            setSkeletonCount(newEntries.length);
            return newEntries;
        });
    }

    const notifyBackupPolicyWasDeleted = (id: number) => {
        queryClient.setQueryData(queryKey, (entries: QueryListEntry[]): QueryListEntry[] => {
            const newEntries = entries.filter(entry => entry.id !== id);
            setSkeletonCount(newEntries.length);
            return newEntries;
        });
    };

    const notifyBackupPoliciesPotentiallyDirty = () => {
        queryClient.invalidateQueries({
            queryKey: [queryKey[0]],
            exact: false,
            refetchType: "all"
        });
    }

    return {
        queryKey,
        getAllQuery,
        mongoDatabaseId,
        notifyBackupPolicyWasDeleted,
        notifyBackupPolicyWasAdded,
        notifyBackupPoliciesPotentiallyDirty,
        skeletonCount: skeletons
    }
}

type BackupPoliciesListQueryClientContextValue = ReturnType<typeof createBackupPoliciesListQueryClient>;
const BackupPoliciesListQueryClient = createContext<BackupPoliciesListQueryClientContextValue | null>(null);

export const BackupPoliciesListQueryClientProvider = ({
    databaseId,
    children
}: {
    databaseId?: number | undefined,
    children: React.ReactNode
}) => {
    const value = createBackupPoliciesListQueryClient(databaseId);
    return ( 
        <BackupPoliciesListQueryClient.Provider value={value}>
            {children}
        </BackupPoliciesListQueryClient.Provider>
    );
}

export const tryUseBackupPoliciesListQueryClient = () => {
    return useContext(BackupPoliciesListQueryClient);
}

export const useBackupPoliciesListQueryClient = () => {
    const value = tryUseBackupPoliciesListQueryClient();
    if(!value) throw new Error(`${useBackupPoliciesListQueryClient.name} must be used within a ${BackupPoliciesListQueryClientProvider.name}`);
    return value;
}
