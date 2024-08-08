import { TaskCommands, TaskExecutor, TaskExecuteResult, TaskCancelledError } from "./task-runner";
import { MongoDatabaseAccess, mongoDatabases } from "@backend/db/mongodb-database.schema";
import { ResolvedTaskState, TaskCancellationType } from "@backend/db/task.schema";
import { database } from "@backend/db";
import { eq } from "drizzle-orm";
import { ProcessCancelledError, runProcessesPiped } from "@lib/process";
import { MongodumpOutputProgressExtractor, getCollectionMetadata } from "./mongo-utils";

export class MongoImportExecutor implements TaskExecutor<{importFromMongoDatabaseId:number}> {
    
    async execute(commands: TaskCommands, mongoDatabaseAccess: MongoDatabaseAccess, {importFromMongoDatabaseId}: {importFromMongoDatabaseId:number}): Promise<TaskExecuteResult> {

      const databaseToImportFrom = await database.query.mongoDatabases.findFirst({ where: eq(mongoDatabases.id, importFromMongoDatabaseId) });
      
      if(!databaseToImportFrom) {
          return {
              resolvedState: ResolvedTaskState.Error,
              message: "Database to import from not found",
          };
      }

      await commands.setCancellationType(TaskCancellationType.SafeToCancel);
      commands.reportProgress({ hasProgressValues: false,  message: "Gathering info" });
      const databaseImportFromCollectionMetadata = await getCollectionMetadata(databaseToImportFrom);

      await commands.setCancellationType(TaskCancellationType.DangerousToCancel);
      commands.reportProgress({ hasProgressValues: false,  message: "Starting import..." });

      const progessExtractor = new MongodumpOutputProgressExtractor(
        databaseToImportFrom,
        databaseImportFromCollectionMetadata,
        (progress) => {

          if(progress.current >= progress.total)
          {
            commands.reportProgress({ 
              hasProgressValues: false,
              message: `Waiting for documents to be processed...`
            });
          }
          else
          {
            commands.reportProgress({ 
              hasProgressValues: true,
              countedThingName: "Documents",
              total: progress.total,
              current: progress.current,
              message: `Copying over documents`
            });
          }
        }
      )

      await runProcessesPiped([
        {
          command: 'mongodump',
          args: [
            `--uri=${databaseToImportFrom.connectionUri}`,
            '--authenticationDatabase=admin',
            `--db=${databaseToImportFrom.databaseName}`,
            '--archive'
          ],
          stderr: (data) => {
            progessExtractor.processData(data);
          }
        },
        {
          command: 'mongorestore',
          args: [
            `--uri=${mongoDatabaseAccess.connectionUri}`,
            '--authenticationDatabase=admin',
            `--nsInclude=${databaseToImportFrom.databaseName}.*`,
            `--nsFrom=${databaseToImportFrom.databaseName}.*`,
            `--nsTo=${mongoDatabaseAccess.databaseName}.*`,
            '--noIndexRestore',
            '--drop',
            '--archive'
          ]
        }
      ], async () => {
        await commands.throwIfCancelled();
      });
      
      return { 
        resolvedState: ResolvedTaskState.Sucessful, 
        message: "Imported successfully",
      };

    }

}
