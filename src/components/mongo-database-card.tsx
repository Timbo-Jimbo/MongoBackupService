import { deleteMongoDatabase, getMongoDatabaseConnectionStatus, startManualBackup, startRestore } from "@actions/mongo";
import { Backup } from "@backend/db/backup.schema";
import { MongoDatabaseCensored, MongoDatabaseConnection } from "@backend/db/mongodb-database.schema";
import { Task, TaskType } from "@backend/db/task.schema";
import { Badge } from "@comp/badge";
import { Button } from "@comp/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuPortal, DropdownMenuSubTrigger, DropdownMenuSubContent } from "@comp/dropdown-menu";
import { LoadingSpinner } from "@comp/loading-spinner";
import { toast, toastForActionResult } from "@comp/toasts";
import { ArrowPathIcon, SignalIcon, SignalSlashIcon, Square3Stack3DIcon, TrashIcon } from "@heroicons/react/20/solid";
import { tryUseBackupListQueryClient } from "@lib/providers/backup-list-query-client";
import { useMongoDatabaseListQueryClient } from "@lib/providers/mongo-database-list-query-client";
import { tryUseTaskListQueryClient } from "@lib/providers/task-list-query-client";
import { cn, timeAgoString } from "@lib/utils";
import { DotsVerticalIcon } from "@radix-ui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

type MongoDatabaseCardProps = {
  mongoDatabase: MongoDatabaseCensored,
  backups: Backup[],
  latestTask?: Task
};

function ConnectionBadge({isPending, isFetching, data}: {isPending: boolean, isFetching: boolean, data: {connectionStatus: MongoDatabaseConnection} | undefined}) {

  return (
    <>
      {isPending && (
        <Badge variant={"outline"} >
          <LoadingSpinner className="w-4 h-4 mr-2" />
          Pinging...
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

function taskTypeString(task: Task) {
  switch(task.type){
    case TaskType.Restore: return "Restoring Backup";
    case TaskType.Seed: return "Seeding from another database";
    case TaskType.ManualBackup: return "Performing Backup (Manual Trigger)";
    case TaskType.ScheduledBackup: return "Performing Backup (Scheduled)";
    default: return "Running Task";
  }
}

function WorkBadge({
  task
}: {
  task?: Task | undefined
}) {
  return (
    <>
      {(!task || task.completedAt) && (
        <Badge variant={"secondary"}>
          No Active Tasks
        </Badge>
      )}
      {(task && !task.isComplete) && (
        <Badge variant={"outline"} className="animate-pulse">
          <LoadingSpinner className="w-4 h-4 mr-2" />
          {taskTypeString(task)}
        </Badge>
      )}
    </>
  )
}

export function MongoDatabaseCard({
  mongoDatabase,
  backups,
  latestTask
}: MongoDatabaseCardProps) {

  const queryClient = useQueryClient();
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
          <WorkBadge task={latestTask}/>
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
                  const toastId = toast.loading("Initiating task...");
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
                      {backups.map((backup) => (
                        <DropdownMenuItem 
                          key={backup.id}
                          onClick={() => {
                            const toastId = toast.loading("Initiating task...");
                            restoreBackupMutation.mutate(backup.id, {
                              onSettled: () => {
                                toast.dismiss(toastId);
                              }
                            });
                          }}
                        >
                          {timeAgoString(backup.createdAt)}
                        </DropdownMenuItem>    
                      ))}
                      {backups.length == 0 && (
                        <DropdownMenuItem disabled>
                          No backups available
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="bg-destructive text-destructive-foreground" onClick={() => deleteDatabaseMutation.mutate()} disabled={deleteDatabaseMutation.isPending}>
                    <TrashIcon className="w-4 h-4 mr-2" />
                    Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

        </div>
      </div>
      <div className="flex flex-row gap-2 place-items-center">
        <p className="text-sm opacity-50">{mongoDatabase.censoredConnectionUri}</p>
      </div>
    </div>
  );
}