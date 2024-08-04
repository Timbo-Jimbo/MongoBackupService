import { getMongoDatabaseConnectionStatus } from "@actions/mongo";
import { MongoDatabaseCensored, MongoDatabaseConnection } from "@backend/db/mongodb-instance.schema";
import { Badge } from "@comp/badge";
import { LoadingSpinner } from "@comp/loading-spinner";
import { SignalIcon, SignalSlashIcon } from "@heroicons/react/20/solid";
import { useQuery } from "@tanstack/react-query";

export function MongoDatabaseCard({
  mongoDatabase,
}: {
  mongoDatabase: MongoDatabaseCensored,
}) {

  const dbStatusQuery = useQuery({
    queryKey: ["mongoDatabaseStatus", mongoDatabase.id],
    queryFn: () => getMongoDatabaseConnectionStatus(mongoDatabase.id),
    refetchInterval: (query) => query.state.data?.connectionStatus != MongoDatabaseConnection.Online ? 5000 : 10000,
  })

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-row gap-2 place-items-center">
        <div className="flex flex-row gap-2 place-items-center">              
          <h1 className="text-lg font-semibold capitalize">{mongoDatabase.referenceName}</h1>
          {dbStatusQuery.isPending && (
            <Badge variant={"outline"} >
              <LoadingSpinner className="w-4 h-4 mr-2" />
              Pinging...
            </Badge>
          )}
          {dbStatusQuery.data?.connectionStatus == MongoDatabaseConnection.Online && (
            <Badge variant={"secondary"} >
              {dbStatusQuery.isFetching ? <LoadingSpinner className="w-4 h-4 mr-2 -ml-1 text-green-500" /> : <SignalIcon className="w-4 h-4 mr-2 -ml-1 text-green-500" /> }
              Online
            </Badge>
          )}
          {dbStatusQuery.data?.connectionStatus != MongoDatabaseConnection.Online && (
            <Badge variant={"secondary"}>
              {dbStatusQuery.isFetching ? <LoadingSpinner className="w-4 h-4 mr-2 -ml-1 text-red-500" /> : <SignalSlashIcon className="w-4 h-4 mr-2 -ml-1 text-red-500" /> }
              {dbStatusQuery.data?.connectionStatus}
            </Badge>
          )}
        </div>
      </div>
      <p className="text-sm opacity-50">{mongoDatabase.censoredConnectionUri}</p>
    </div>
  );
}