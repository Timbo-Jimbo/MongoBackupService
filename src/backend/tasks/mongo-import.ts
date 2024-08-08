import { TaskCommands, TaskExecutor, TaskExecuteResult, TaskCancelledError } from "./task-runner";
import { MongoDatabaseAccess, mongoDatabases } from "@backend/db/mongodb-database.schema";
import { ResolvedTaskState, TaskCancellationType } from "@backend/db/task.schema";
import { database } from "@backend/db";
import { eq } from "drizzle-orm";
import { ProcessCancelledError, runProcessesPiped } from "@lib/process";

export class MongoImportExecutor implements TaskExecutor<{importFromMongoDatabaseId:number}> {
    
    async execute(commands: TaskCommands, mongoDatabaseAccess: MongoDatabaseAccess, {importFromMongoDatabaseId}: {importFromMongoDatabaseId:number}): Promise<TaskExecuteResult> {
        try
        {
            const databaseToImportFrom = await database.query.mongoDatabases.findFirst({ where: eq(mongoDatabases.id, importFromMongoDatabaseId) });
            
            if(!databaseToImportFrom) {
                return {
                    resolvedState: ResolvedTaskState.Error,
                    message: "Database to import from not found",
                };
            }

            await commands.setCancellationType(TaskCancellationType.NotCancellable);
            
            commands.reportProgress({ hasProgressValues: false,  message: "Importing data" });

            try
            {
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
                    console.log("mongodump stderr", data.toString());
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
                  ],
                  stderr: (data) => {
                    console.log("mongorestore stderr", data.toString());
                  }
                }
              ]);
              
              return { 
                resolvedState: ResolvedTaskState.Sucessful, 
                message: "Imported successfully",
              };
            }
            catch(e)
            {
              if(e instanceof ProcessCancelledError)
              {
                throw new TaskCancelledError();
              }
              return { 
                resolvedState: ResolvedTaskState.Error,
                message: "Failed to execute import commands",
              };
            }
        }
        catch(e)
        {
            throw e;
        }
    }

}
