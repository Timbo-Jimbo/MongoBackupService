import { getMongoDatabaseConnectionStatus, startManualBackup } from "@actions/mongo";
import { MongoDatabaseCensored, MongoDatabaseConnection } from "@backend/db/mongodb-database.schema";
import { Badge } from "@comp/badge";
import { ButtonWithSpinner } from "@comp/button";
import { LoadingSpinner } from "@comp/loading-spinner";
import { useToast } from "@comp/use-toast";
import { SignalIcon, SignalSlashIcon } from "@heroicons/react/20/solid";
import { cn } from "@lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function MongoDatabaseCard({
  mongoDatabase,
}: {
  mongoDatabase: MongoDatabaseCensored,
}) {

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const dbStatusQuery = useQuery({
    queryKey: ["mongoDatabaseStatus", mongoDatabase.id],
    queryFn: () => getMongoDatabaseConnectionStatus(mongoDatabase.id),
    refetchInterval: (query) => query.state.data?.connectionStatus != MongoDatabaseConnection.Online ? 5000 : 10000,
  })

  const startBackupMutation = useMutation({
    mutationFn: async () => await startManualBackup(mongoDatabase.id),
    onSuccess: (startResult) => {

      if(!startResult || !startResult.success) {
        toast({
          title: "Failed to start backup",
          description: startResult?.message,
          variant: "destructive"
        })
      }
      else {
        toast({
          title: "Backup started",
        })
      }

      queryClient.invalidateQueries({
        queryKey: ["tasks"]
      });
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
      </div>
      <div className="flex flex-row gap-2 place-items-center">
        <p className="text-sm opacity-50">{mongoDatabase.censoredConnectionUri}</p>
        <div className="flex flex-row flex-grow justify-end place-items-center">
            <ButtonWithSpinner className="w-min" onClick={() => startBackupMutation.mutate()} isLoading={startBackupMutation.isPending}>
              {startBackupMutation.isPending ? "Starting..." : "Backup now"}
            </ButtonWithSpinner>
        </div>
      </div>
    </div>
  );
}