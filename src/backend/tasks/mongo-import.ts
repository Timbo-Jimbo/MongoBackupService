import { TaskCommands, TaskExecutor, TaskExecuteResult, TaskCancelledError } from "./task-runner";
import { MongoDatabaseAccess, mongoDatabases } from "@backend/db/mongo-database.schema";
import { ResolvedTaskState, TaskCancellationType } from "@backend/db/task.schema";
import { database } from "@backend/db";
import { eq } from "drizzle-orm";
import { ProcessCancelledError, runProcessesPiped } from "@lib/process";
import { MongodumpOutputProgressExtractor, getCollectionMetadata } from "./mongo-utils";

type TaskParams = {importFromMongoDatabaseId:number};

export class MongoImportExecutor implements TaskExecutor<TaskParams> {
    
    async execute(commands: TaskCommands, databases: MongoDatabaseAccess[], {importFromMongoDatabaseId}: TaskParams): Promise<TaskExecuteResult> {

      const importingDatabase = databases[0];
      const exportingDatabase = databases[1];

      await commands.setCancellationType(TaskCancellationType.SafeToCancel);
      commands.reportProgress({ hasProgressValues: false,  message: "Gathering info" });
      const databaseImportFromCollectionMetadata = await getCollectionMetadata(exportingDatabase);

      await commands.setCancellationType(TaskCancellationType.DangerousToCancel);
      commands.reportProgress({ hasProgressValues: false,  message: "Starting import..." });

      const progessExtractor = new MongodumpOutputProgressExtractor(
        exportingDatabase,
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
            `--uri=${exportingDatabase.connectionUri}`,
            '--authenticationDatabase=admin',
            `--db=${exportingDatabase.databaseName}`,
            '--archive'
          ],
          stderr: (data) => {
            progessExtractor.processData(data);
          }
        },
        {
          command: 'mongorestore',
          args: [
            `--uri=${importingDatabase.connectionUri}`,
            '--authenticationDatabase=admin',
            `--nsInclude=${exportingDatabase.databaseName}.*`,
            `--nsFrom=${exportingDatabase.databaseName}.*`,
            `--nsTo=${importingDatabase.databaseName}.*`,
            '--noIndexRestore',
            '--drop',
            '--archive'
          ]
        }
      ], async () => {
        await commands.throwIfCancelled();
      });
      
      return { 
        resolvedState: ResolvedTaskState.Completed, 
        message: "Imported successfully",
      };

    }

}
