import { spawn } from "node:child_process";
import { TaskCommands, TaskExecutor, TaskExecuteResult, TaskCancelledError } from "./task-runner";
import { MongoDatabaseAccess, mongoDatabases } from "@backend/db/mongodb-database.schema";
import { ResolvedTaskState, TaskCancellationType } from "@backend/db/task.schema";
import { database } from "@backend/db";
import { eq } from "drizzle-orm";

type DumpRestoreResult = {
    wasSuccessful: boolean;
    error?: string;
}

export class MongoImportExecutor implements TaskExecutor<{importFromMongoDatabaseId:number}> {
    
    mongoDumpRestore(
        sourceUri: string,
        sourceDb: string,
        destUri: string,
        destDb: string
      ): Promise<DumpRestoreResult> {
        return new Promise((resolve, reject) => {

          const mongodump = spawn('mongodump', [
            `--uri=${sourceUri}`,
            '--authenticationDatabase=admin',
            `--db=${sourceDb}`,
            '--archive'
          ]);
      
          const mongorestore = spawn('mongorestore', [
            `--uri=${destUri}`,
            '--authenticationDatabase=admin',
            `--nsInclude=${sourceDb}.*`,
            `--nsFrom=${sourceDb}.*`,
            `--nsTo=${destDb}.*`,
            '--noIndexRestore',
            '--drop',
            '--archive'
          ]);
      
          mongodump.stdout.pipe(mongorestore.stdin);
      
          let hasResult = false;

          const ResolveWithResult = (result: DumpRestoreResult) =>
          {
            if (hasResult)
              return;
     
            mongodump.kill();
            mongorestore.kill();
            
            hasResult = true;
            resolve(result);
          }
      
          mongorestore.on('close', (code) => {
            if (code === 0) {
                ResolveWithResult({ wasSuccessful: true });
            } else {
                ResolveWithResult({ wasSuccessful: false, error: `mongorestore process exited with code ${code}.` });
            }
          });
      
          mongodump.on('error', (error) => {
            ResolveWithResult({ wasSuccessful: false, error: `Failed to start mongodump process: ${error}` });
          });
      
          mongorestore.on('error', (error) => {
            ResolveWithResult({ wasSuccessful: false, error: `Failed to start mongorestore process: ${error}` });
          });
      
          mongodump.on('close', (code) => {
            if (code !== 0) {
                ResolveWithResult({ wasSuccessful: false, error: `mongodump process exited with code ${code}.` });
            }
          });
        });
      }

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
            const processResult = await this.mongoDumpRestore(
                databaseToImportFrom.connectionUri,
                databaseToImportFrom.databaseName,
                mongoDatabaseAccess.connectionUri,
                mongoDatabaseAccess.databaseName
            );

            if(!processResult.wasSuccessful) {
                return {
                    resolvedState: ResolvedTaskState.Error,
                    message: `Failed to import data: ${processResult.error}`,
                };
            }
            else {
                return { 
                    resolvedState: ResolvedTaskState.Sucessful, 
                    message: "Imported successfully",
                };
            }
        }
        catch(e)
        {
            throw e;
        }
    }

}
