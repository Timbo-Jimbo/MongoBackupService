import { deleteMongoDatabase, getMongoDatabaseConnectionStatus, startManualBackup } from "@actions/mongo";
import { DatabaseBackupSummary } from "@backend/db/backup.schema";
import { MongoDatabaseCensored, MongoDatabaseConnection } from "@backend/db/mongodb-database.schema";
import { Badge } from "@comp/badge";
import { Button, ButtonWithSpinner } from "@comp/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@comp/dropdown-menu";
import { LoadingSpinner } from "@comp/loading-spinner";
import { toastForActionResult } from "@comp/toasts";
import { SignalIcon, SignalSlashIcon, TrashIcon } from "@heroicons/react/20/solid";
import { useMongoDatabaseListQueryClient } from "@lib/providers/mongo-database-list-query-client";
import { cn } from "@lib/utils";
import { DotsVerticalIcon } from "@radix-ui/react-icons";
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

type MongoDatabaseCardProps = {
  mongoDatabase: MongoDatabaseCensored,
  backupSummary: DatabaseBackupSummary
};

export function MongoDatabaseCard({
  mongoDatabase,
  backupSummary,
}: MongoDatabaseCardProps) {

  const queryClient = useQueryClient();
  const mongoDatbaseListQueryClient = useMongoDatabaseListQueryClient();

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
      
      await queryClient.invalidateQueries({
        queryKey: ["tasks"]
      });
    }
  });

  const deleteDatabaseMutation = useMutation({
    mutationFn: async () => await deleteMongoDatabase(mongoDatabase.id),
    onSuccess: async (result) => {

      toastForActionResult(result);

      if(!result?.success) return;

      mongoDatbaseListQueryClient.notifyDatabaseWasDeleted(mongoDatabase.id);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["backups"] })
      ]);
    }
  });

  return (
    <div className="flex flex-col my-4 gap-4">
      <div className="flex flex-row gap-2 place-items-center">
        <div className="flex flex-row gap-2 place-items-center">              
          <h1 className="text-lg font-semibold capitalize">{mongoDatabase.referenceName}</h1>
          {dbStatusQuery.isPending && (
            <Badge variant={"outline"} >
              <LoadingSpinner className="w-4 h-4 mr-2" />
              Pinging...
            </Badge>
          )}
          {dbStatusQuery.data && dbStatusQuery.data.connectionStatus == MongoDatabaseConnection.Online && (
            <Badge variant={"secondary"} >
              <SignalIcon className={cn([
                "w-4 h-4 mr-2 -ml-1 text-green-500",
                (dbStatusQuery.isFetching && "animate-pulse")
              ])} />
              Online
            </Badge>
          )}
          {dbStatusQuery.data && dbStatusQuery.data.connectionStatus != MongoDatabaseConnection.Online && (
            <Badge variant={"secondary"}>
              <SignalSlashIcon className={cn([
                "w-4 h-4 mr-2 -ml-1 text-red-500",
                (dbStatusQuery.isFetching && "animate-pulse")
              ])} />
              {dbStatusQuery.data?.connectionStatus}
            </Badge>
          )}
        </div>
        <div className="flex flex-row flex-grow gap-2 justify-end place-items-center">
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant={"ghost"} size="icon">
                  <DotsVerticalIcon className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
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
        <div className="flex flex-row flex-grow gap-2 justify-end place-items-center">
            <ButtonWithSpinner className="w-min" onClick={() => startBackupMutation.mutate()} isLoading={startBackupMutation.isPending}>
              {startBackupMutation.isPending ? "Starting..." : "Create Backup"}
            </ButtonWithSpinner>
        </div>
      </div>
    </div>
  );
}