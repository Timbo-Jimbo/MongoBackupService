import { deleteMongoDatabase, getMongoDatabaseConnectionStatus, startImport, startManualBackup, startRestore } from "@actions/mongo";
import { Backup } from "@backend/db/backup.schema";
import { MongoDatabaseCensored, MongoDatabaseConnection } from "@backend/db/mongo-database.schema";
import { TaskWithInvolvements } from "@backend/db/task.schema";
import { AlertDialog, AlertGenericConfirmationDialogContent } from "@comp/alert-dialog";
import { Badge } from "@comp/badge";
import { Button } from "@comp/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuPortal, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuLabel } from "@comp/dropdown-menu";
import { LoadingSpinner } from "@comp/loading-spinner";
import { toast, toastForActionResult } from "@comp/toasts";
import { ArrowDownOnSquareIcon, ArrowPathIcon, SignalIcon, SignalSlashIcon, Square3Stack3DIcon, TrashIcon } from "@heroicons/react/20/solid";
import { tryUseBackupListQueryClient } from "@lib/providers/backup-list-query-client";
import { useMongoDatabaseListQueryClient } from "@lib/providers/mongo-database-list-query-client";
import { tryUseTaskListQueryClient } from "@lib/providers/task-list-query-client";
import { cn, timeAgoString } from "@lib/utils";
import { DotsVerticalIcon } from "@radix-ui/react-icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Fragment, useState } from "react";

type OtherDatabase = {
  mongoDatabase: MongoDatabaseCensored,
  backups: Backup[],
}

type MongoDatabaseCardProps = {
  mongoDatabase: MongoDatabaseCensored,
  ownBackups: Backup[],
  latestTask?: TaskWithInvolvements
  otherDatabases: OtherDatabase[],
};

function ConnectionBadge({isPending, isFetching, data}: {isPending: boolean, isFetching: boolean, data: {connectionStatus: MongoDatabaseConnection} | undefined}) {

  return (
    <>
      {isPending && (
        <Badge variant={"outline"} className="animate-pulse" >
          <SignalIcon className="w-4 h-4 mr-2" />
          Pinging
        </Badge>
      )}
      {data && data.connectionStatus == MongoDatabaseConnection.Online && (
        <Badge variant={"secondary"} >
          <SignalIcon className={cn([
            "w-4 h-4 mr-2 -ml-1 text-green-500",
            (isFetching && "animate-pulse")
          ])} />
          Online
        </Badge>
      )}
      {data && data.connectionStatus != MongoDatabaseConnection.Online && (
        <Badge variant={"secondary"}>
          <SignalSlashIcon className={cn([
            "w-4 h-4 mr-2 -ml-1 text-red-500",
            (isFetching && "animate-pulse")
          ])} />
          {data?.connectionStatus}
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
  task: TaskWithInvolvements | undefined
}) {
  return (
    <>
      {(task && !task.isComplete) && (
        <Badge variant={"outline"} className="animate-pulse">
          <LoadingSpinner className="w-4 h-4 mr-2" />
          {task.involvements.find(i => i.mongoDatabaseId == mongoDatabaseId)?.reason ?? "Working on a task"}
        </Badge>
      )}
    </>
  )
}

export function MongoDatabaseCard({
  mongoDatabase,
  ownBackups,
  latestTask,
  otherDatabases,
}: MongoDatabaseCardProps) {

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const mongoDatbaseListQueryClient = useMongoDatabaseListQueryClient();
  const taskListQueryClient = tryUseTaskListQueryClient();
  const backupQueryClient = tryUseBackupListQueryClient();

  const dbStatusQuery = useQuery({
    queryKey: [mongoDatbaseListQueryClient.queryKey, "status", mongoDatabase.id],
    queryFn: () => getMongoDatabaseConnectionStatus(mongoDatabase.id),
    refetchInterval: (query) => query.state.data?.connectionStatus != MongoDatabaseConnection.Online ? 5000 : 10000,
  })

  const startBackupMutation = useMutation({
    mutationFn: async () => await startManualBackup(mongoDatabase.id),
    onSuccess: async (result) => {

      toastForActionResult(result);

      if(!result?.success) return;
      taskListQueryClient?.notifyTaskWasAdded();
      mongoDatbaseListQueryClient.notifyDatabasesPotentiallyDirty();
    }
  });

  const startImportMutation = useMutation({
    mutationFn: async (importFromMongoDatabaseId: number) => await startImport(mongoDatabase.id, importFromMongoDatabaseId),
    onSuccess: async (result) => {

      toastForActionResult(result);

      if(!result?.success) return;
      taskListQueryClient?.notifyTaskWasAdded();
      mongoDatbaseListQueryClient.notifyDatabasesPotentiallyDirty();
    }
  });

  const restoreBackupMutation = useMutation({
    mutationFn: async (backupId: number) => await startRestore(mongoDatabase.id, backupId),
    onSuccess: async (result) => {

      toastForActionResult(result);

      if(!result?.success) return;
      taskListQueryClient?.notifyTaskWasAdded();
    }
  });

  const deleteDatabaseMutation = useMutation({
    mutationFn: async () => await deleteMongoDatabase(mongoDatabase.id),
    onSuccess: async (result) => {

      toastForActionResult(result);

      if(!result?.success) return;

      mongoDatbaseListQueryClient.notifyDatabaseWasDeleted(mongoDatabase.id);
      backupQueryClient?.notifyBackupsPotentiallyDirty();
      taskListQueryClient?.notifyTasksPotentiallyDirty();
    }
  });

  return (
    <div className="flex flex-col my-4 gap-4">
      <div className="flex flex-row gap-2 place-items-center">
        <div className="flex flex-row gap-2 place-items-center">              
          <h1 className="text-lg font-semibold capitalize">{mongoDatabase.referenceName}</h1>
          <ConnectionBadge isPending={dbStatusQuery.isPending} isFetching={dbStatusQuery.isFetching} data={dbStatusQuery.data} />
          <WorkBadge mongoDatabaseId={mongoDatabase.id} task={latestTask}/>
        </div>
        <div className="flex flex-row flex-grow gap-2 justify-end place-items-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant={"ghost"} size="icon">
                  <DotsVerticalIcon className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => {
                  const toastId = toast.loading("Initiating backup...");
                  startBackupMutation.mutate(undefined, {
                    onSettled: () => {
                      toast.dismiss(toastId);
                    }
                  });
                }} disabled={startBackupMutation.isPending}>
                  <Square3Stack3DIcon className="w-4 h-4 mr-2" />
                  Backup Now
                </DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <ArrowPathIcon className="w-4 h-4 mr-2" />
                    Restore...
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
                          From {timeAgoString(backup.createdAt)}
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
                                  From {timeAgoString(backup.createdAt)}
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
                    Import...
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
                          <span className="opacity-50">{database.databaseName}</span>
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
                <DropdownMenuItem className="bg-destructive text-destructive-foreground" disabled={deleteDatabaseMutation.isPending} onClick={() => setDeleteDialogOpen(true)}>
                    <TrashIcon className="w-4 h-4 mr-2" />
                    Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <AlertGenericConfirmationDialogContent 
                body="Are you sure you want to delete this database?"
                onConfirm={() => deleteDatabaseMutation.mutate()}
              />
            </AlertDialog>
        </div>
      </div>
      <div className="flex flex-row gap-2 place-items-center">
        <p className="text-sm opacity-50">{mongoDatabase.censoredConnectionUri}</p>
      </div>
    </div>
  );
}