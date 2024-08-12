import { deleteMongoDatabase, getMongoDatabaseConnectionStatus, startImport, startManualBackup, startRestore } from "@actions/mongo";
import { Backup } from "@backend/db/backup.schema";
import { MongoDatabaseCensored, MongoDatabaseConnection } from "@backend/db/mongo-database.schema";
import { TaskWithRelations } from "@backend/db/task.schema";
import { BackupMode } from "@backend/tasks/compression.enums";
import { Alert, AlertDescription, AlertTitle } from "@comp/alert";
import { AlertDialog, AlertDialogDescription, AlertGenericConfirmationDialogContent } from "@comp/alert-dialog";
import { Badge } from "@comp/badge";
import { Button } from "@comp/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuPortal, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuLabel } from "@comp/dropdown-menu";
import { LoadingSpinner } from "@comp/loading-spinner";
import { toast, toastForActionResult } from "@comp/toasts";
import { ArrowDownOnSquareIcon, ArrowPathIcon, InformationCircleIcon, Square3Stack3DIcon } from "@heroicons/react/20/solid";
import { useBackupListQueryClient } from "@lib/providers/backup-list-query-client";
import { useMongoDatabaseListQueryClient } from "@lib/providers/mongo-database-list-query-client";
import { tryUseTaskListQueryClient } from "@lib/providers/task-list-query-client";
import { cn, timeAgoString } from "@lib/utils";
import { Cross2Icon, DotsVerticalIcon } from "@radix-ui/react-icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Fragment, useEffect, useRef, useState } from "react";
import { DialogStartManualBackup } from "./dialog-start-manual-backup";
import { BackupPoliciesListQueryClientProvider } from "@lib/providers/backup-policies-list-query-client";
import { BackupPoliciesList } from "@app/dashboard/backup-policy-list";
import { useLoadingToastCleaner } from "@lib/use-toast-cleaner";

type Ping = {
  isPending: boolean,
  isFetching: boolean,
  result: MongoDatabaseConnection | undefined
};

function ConnectionBadge({ping}: {ping: Ping}) {

  return (
    <>
      {ping.isPending && (
        <Badge variant={"outline"} className="animate-pulse" key={"connection-badge"}>
          <div className="w-2 h-2 -ml-1 mr-2 bg-stone-500 rounded-full transition-all duration-500">
            <div className="size-full bg-stone-300 rounded-full animate-ping"></div>
          </div>
          Pinging
        </Badge>
      )}
      {ping.result && ping.result == MongoDatabaseConnection.Online && (
        <Badge variant={"secondary"} className="transition-all duration-500" key={"connection-badge"}>
          <div className="w-2 h-2 -ml-1 mr-2 bg-green-500 rounded-full transition-all duration-500" />
          Online
        </Badge>
      )}
      {ping.result && ping.result != MongoDatabaseConnection.Online && (
        <Badge variant={"secondary"} className="transition-all duration-500" key={"connection-badge"}>
          <div className="w-2 h-2 -ml-1 mr-2 bg-red-500 rounded-full transition-all duration-500">
            <div className="size-full bg-rose-300 rounded-full animate-ping"></div>
          </div>
          {ping.result}
        </Badge>
      )}
    </>
  )
}

function WorkBadge({
  mongoDatabaseId,
  task
}: {
  mongoDatabaseId: number,
  task: TaskWithRelations | undefined
}) {
  return (
    <>
      {(task && !task.isComplete) && (
        <Badge variant={"outline"} className="animate-pulse">
          <LoadingSpinner className="w-4 h-4 mr-2" />
          {task.associatedMongoDatabases.find(i => i.mongoDatabaseId == mongoDatabaseId)?.reason ?? "Working on a task"}
        </Badge>
      )}
    </>
  )
}

function Badges({
  mongoDatabase,
  latestTask,
  ping,
  className
}: {
  mongoDatabase: MongoDatabaseCensored,
  latestTask: TaskWithRelations | undefined
  ping: Ping,
  className?: string
}) {
  return (
    <div className={cn(["flex flex-row gap-2", className])}>
      <ConnectionBadge ping={ping}/>
      <WorkBadge mongoDatabaseId={mongoDatabase.id} task={latestTask}/>
    </div>
  )
}

type OtherDatabase = {
  mongoDatabase: MongoDatabaseCensored,
  backups: Backup[],
}

type MongoDatabaseCardProps = {
  mongoDatabase: MongoDatabaseCensored,
  ownBackups: Backup[],
  latestTask?: TaskWithRelations
  otherDatabases: OtherDatabase[],
};

export function MongoDatabaseCard({
  mongoDatabase,
  ownBackups,
  latestTask,
  otherDatabases,
}: MongoDatabaseCardProps) {

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [startManualBackupDialogOpen, setStartManualBackupDialogOpen] = useState(false);
  const mongoDatabaseListQueryClient = useMongoDatabaseListQueryClient();
  const taskListQueryClient = tryUseTaskListQueryClient();
  const backupListQueryClient = useBackupListQueryClient();
  const loadingToastRef = useLoadingToastCleaner();

  const dbStatusQuery = useQuery({
    queryKey: [mongoDatabaseListQueryClient.queryKey, "status", mongoDatabase.id],
    queryFn: () => getMongoDatabaseConnectionStatus(mongoDatabase.id),
    refetchInterval: (query) => query.state.data?.connectionStatus != MongoDatabaseConnection.Online ? 5000 : false,
  })

  const startBackupMutation = useMutation({
    mutationFn: async (backupMode: BackupMode) => await startManualBackup(mongoDatabase.id, backupMode),
    onSuccess: async (result) => {

      toastForActionResult(result);

      if(!result?.success) return;
      taskListQueryClient?.notifyTaskWasAdded();
      mongoDatabaseListQueryClient.notifyDatabasesPotentiallyDirty();
    }
  });

  const startImportMutation = useMutation({
    mutationFn: async (importFromMongoDatabaseId: number) => await startImport(mongoDatabase.id, importFromMongoDatabaseId),
    onSuccess: async (result) => {

      toastForActionResult(result);

      if(!result?.success) return;
      taskListQueryClient?.notifyTaskWasAdded();
      mongoDatabaseListQueryClient.notifyDatabasesPotentiallyDirty();
    }
  });

  const restoreBackupMutation = useMutation({
    mutationFn: async (backupId: number) => await startRestore(mongoDatabase.id, backupId),
    onSuccess: async (result) => {

      toastForActionResult(result);

      if(!result?.success) return;
      taskListQueryClient?.notifyTaskWasAdded();
      mongoDatabaseListQueryClient.notifyDatabasesPotentiallyDirty();
    }
  });

  const deleteDatabaseMutation = useMutation({
    mutationFn: async (deleteBackups: boolean) => await deleteMongoDatabase(mongoDatabase.id, deleteBackups),
    onSuccess: async (result) => {

      toastForActionResult(result);

      if(!result?.success) return;

      mongoDatabaseListQueryClient.notifyDatabaseWasDeleted(mongoDatabase.id);
      backupListQueryClient?.notifyBackupsPotentiallyDirty();
      taskListQueryClient?.notifyTasksPotentiallyDirty();
    }
  });

  const ping = {
    isFetching: dbStatusQuery.isFetching,
    isPending: dbStatusQuery.isPending,
    result: dbStatusQuery.data?.connectionStatus 
  } as Ping;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-row gap-2 place-items-center">
        <div className="flex flex-row gap-2 place-items-center">              
          <h1 className="text-lg font-semibold capitalize">{mongoDatabase.referenceName}</h1>
          <Badges className="hidden lg:inline-flex" ping={ping} mongoDatabase={mongoDatabase} latestTask={latestTask}/>
        </div>
        <div className="flex flex-row flex-grow gap-2 justify-end place-items-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant={"ghost"} size="icon">
                  <DotsVerticalIcon className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem disabled={backupListQueryClient.availableBackupModesQuery.isPending} onClick={() => setStartManualBackupDialogOpen(true)}>
                  <Square3Stack3DIcon className="w-4 h-4 mr-2" />
                  Backup...
                </DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <ArrowPathIcon className="w-4 h-4 mr-2" />
                    Restore
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                      <DropdownMenuLabel>
                        Own Backup
                      </DropdownMenuLabel>
                      {ownBackups.map((backup) => (
                        <DropdownMenuItem 
                          key={backup.id}
                          onClick={() => {
                            const toastId = toast.loading("Initiating restore...");
                            restoreBackupMutation.mutate(backup.id, {
                              onSettled: () => {
                                toast.dismiss(toastId);
                              }
                            });
                          }}
                        >
                          From {timeAgoString(backup.finishedAt)}
                        </DropdownMenuItem>    
                      ))}
                      {ownBackups.length == 0 && (
                        <DropdownMenuItem disabled>
                          No backups available
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator/>
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                          From Other...
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          {otherDatabases.map((otherDatabase, index) => (
                            <Fragment key={otherDatabase.mongoDatabase.id}>
                              <DropdownMenuLabel>
                                {otherDatabase.mongoDatabase.referenceName}
                              </DropdownMenuLabel>
                              {otherDatabase.backups.map((backup) => (
                                <DropdownMenuItem 
                                  key={backup.id}
                                  onClick={() => {
                                    const toastId = toast.loading("Initiating restore...");
                                    restoreBackupMutation.mutate(backup.id, {
                                      onSettled: () => {
                                        toast.dismiss(toastId);
                                      }
                                    });
                                  }}
                                >
                                  From {timeAgoString(backup.finishedAt)}
                                </DropdownMenuItem>    
                              ))}
                              {otherDatabase.backups.length == 0 && (
                                <DropdownMenuItem disabled>
                                  No backups available
                                </DropdownMenuItem>
                              )}
                              {index < otherDatabases.length - 1 && <DropdownMenuSeparator/>}
                            </Fragment>
                          ))}
                          {otherDatabases.length == 0 && (
                            <DropdownMenuItem disabled>
                              No Other Databases
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <ArrowDownOnSquareIcon className="w-4 h-4 mr-2" />
                    Import
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                      {otherDatabases.map(otherDb => otherDb.mongoDatabase).map((database) => (
                        <DropdownMenuItem 
                          key={database.id}
                          className="flex-col items-start"
                          onClick={() => {
                            const toastId = toast.loading("Initiating import...");
                            startImportMutation.mutate(database.id, {
                              onSettled: () => {
                                toast.dismiss(toastId);
                              }
                            });
                          }}
                        >
                          <span className="font-semibold">{database.referenceName}</span>
                          <span className="text-muted-foreground">{database.databaseName}</span>
                        </DropdownMenuItem>    
                      ))}
                      {otherDatabases.length == 0 && (
                        <DropdownMenuItem disabled>
                          No Other Databases
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="bg-destructive/75 focus:bg-destructive text-destructive-foreground" disabled={deleteDatabaseMutation.isPending} onClick={() => setDeleteDialogOpen(true)}>
                    <Cross2Icon className="w-4 h-4 mr-2" />
                    Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <AlertGenericConfirmationDialogContent 
                destructive
                onConfirm={() => {
                  loadingToastRef.current = toast.loading("Deleting database...");
                  deleteDatabaseMutation.mutate(true, {
                    onSettled: () => {
                      toast.dismiss(loadingToastRef.current);
                    }
                  });

                  setDeleteDialogOpen(false);
                }}
              >
                <div className="flex flex-col gap-4">
                  <AlertDialogDescription>
                    Are you sure you want to remove this database?
                  </AlertDialogDescription>
                  <AlertDialogDescription>
                    <Alert>
                      <InformationCircleIcon className="w-4 h-4 mr-2" />
                      <AlertTitle>
                        Your backups are retained
                      </AlertTitle>
                      <AlertDescription>
                        This will <b>not</b> delete any backups associated with this database! They will become orphaned and you can delete them separately.
                      </AlertDescription>
                    </Alert>
                  </AlertDialogDescription>
                </div>
              </AlertGenericConfirmationDialogContent>
            </AlertDialog>
            <DialogStartManualBackup 
              open={startManualBackupDialogOpen} 
              onOpenChange={setStartManualBackupDialogOpen} 
              onBackupModeSelected={(mode) => {
                const toastId = toast.loading("Initiating backup...");
                startBackupMutation.mutate(mode, {
                  onSettled: () => {
                    toast.dismiss(toastId);
                  }
                });

                setStartManualBackupDialogOpen(false);
              }}
              supportedOptions={backupListQueryClient?.availableBackupModesQuery.data ?? [BackupMode.Gzip]}
            />
        </div>
      </div>
      <Badges className="inline-flex lg:hidden" ping={ping} mongoDatabase={mongoDatabase} latestTask={latestTask}/>
      <div className="flex flex-row gap-2 place-items-center">
        <p className="text-sm text-muted-foreground">{mongoDatabase.censoredConnectionUri}</p>
      </div>
      <BackupPoliciesListQueryClientProvider databaseId={mongoDatabase.id}>
        <BackupPoliciesList />
      </BackupPoliciesListQueryClientProvider>
    </div>
  );
}