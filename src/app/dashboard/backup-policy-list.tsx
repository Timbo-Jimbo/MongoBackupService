"use client"

import { BackupPolicyCard } from "@/components/backup-policy-card";
import { DialogCreateBackupPolicy } from "@/components/dialog-create-backup-policy";
import { SkeletonList } from "@/components/skeleton-list";
import { createBackupPolicy } from "@actions/backup-policies";
import { InsertBackupPolicy } from "@backend/db/backup-policy.schema";
import { BackupMode } from "@backend/tasks/compression.enums";
import { Button } from "@comp/button";
import { Card, CardContent, CardHeader, CardTitle } from "@comp/card";
import { Separator } from "@comp/separator";
import { toastForActionResult } from "@comp/toasts";
import { PlusIcon } from "@heroicons/react/20/solid";
import { useBackupListQueryClient } from "@lib/providers/backup-list-query-client";
import { useBackupPoliciesListQueryClient } from "@lib/providers/backup-policies-list-query-client";
import { InfoCircledIcon } from "@radix-ui/react-icons";
import { useMutation } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { toast } from "sonner";

export function BackupPoliciesList() {

  const backupPolicyListClient = useBackupPoliciesListQueryClient();
  const backupListQueryClient = useBackupListQueryClient();
  const [addBackupPolicyDialogOpen, setAddBackupPolicyDialogOpen] = useState(false);

  const createBackupPolicyMutation = useMutation({
    mutationFn: async (backupPolicy: InsertBackupPolicy) => {
      return await createBackupPolicy(backupPolicy);
    },
    onSuccess: async (result) => {
      toastForActionResult(result);
      if(!result?.success) return;
      backupPolicyListClient.notifyBackupPolicyWasAdded(result.backupPolicy);
    }
  });
  
  const isReady = backupPolicyListClient.getAllQuery.isFetched;
  const results = backupPolicyListClient.getAllQuery.data || [];
  const mongoDatbaseId = backupPolicyListClient.mongoDatabaseId;
  const isShowingPoliciesForSingleDb = mongoDatbaseId !== undefined;

  return (
    <div className="ml-4 flex flex-col gap-2">
      <div className="flex flex-col">
        <div className="font-bold flex justify-between items-center">
          <span>Backup Policies</span>
          <div className="flex flex-row gap-2 place-items-center">
          {isShowingPoliciesForSingleDb && (
            <>
              <Button variant={"outline"} onClick={() => setAddBackupPolicyDialogOpen(true)}>
                <PlusIcon className="w-4 h-4 mr-2" />
                Create Backup Policy
              </Button>
              <DialogCreateBackupPolicy 
                supportedOptions={backupListQueryClient.availableBackupModesQuery?.data ?? []}
                open={addBackupPolicyDialogOpen}
                onOpenChange={setAddBackupPolicyDialogOpen}
                onCreatePolicy={(cronExpression: string, retentionDays: number, mode: BackupMode) => {
                  setAddBackupPolicyDialogOpen(false);
                  const toastId = toast.loading("Creating backup policy...");

                  createBackupPolicyMutation.mutate({
                    mongoDatabaseId: mongoDatbaseId,
                    backupIntervalCron: cronExpression,
                    backupRetentionDays: retentionDays,
                    backupMode: mode
                  }, {
                    onSettled: () => {
                      toast.dismiss(toastId);
                    }
                  });
                }}
              />
            </>
          )}
        </div>
        </div>
      </div>
      <div>
        {isReady && results.length === 0 && <p className="text-muted-foreground text-sm"><InfoCircledIcon className="w-4 h-4 mr-2 inline" />There are no backup policies to show.</p>}
        
        {!isReady && <SkeletonList count={backupPolicyListClient.skeletonCount} className="h-[3rem]"/>}
        {results.map((backupPolicy, index, backupPolicies) => (
          <Fragment key={backupPolicy.id}>
            <BackupPolicyCard
              index={index}
              backupPolicy={backupPolicy} 
            />
            {index < backupPolicies.length - 1 && <Separator className="my-4" />}
          </Fragment>
        ))}
      </div>
    </div>
  );
}