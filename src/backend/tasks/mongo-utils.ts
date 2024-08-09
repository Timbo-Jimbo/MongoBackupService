import { MongoDatabaseAccess } from "@backend/db/mongo-database.schema";
import { MongoClient } from "mongodb";
import { exec } from "node:child_process";
import { promisify } from "util";

export class MongodumpOutputProgressExtractor 
{
    private perCollectionProgress: { name: string, backedUpCount: number, totalCount: number }[] = [];

    constructor(
        private readonly mongoDatabaseAccess: MongoDatabaseAccess,
        private collectionMetadata: { name: string, totalCount: number }[],
        private readonly onProgress: (progress: { current: number, total: number }) => void
    ) {
        collectionMetadata.forEach(c => this.perCollectionProgress.push({ name: c.name, backedUpCount: 0, totalCount: c.totalCount }));
    }

    processData(data: Buffer) {

        // hacky, lets pick apart the output to figure out how many
        // documents have been backed up per collection.
        const str = data.toString();
        const lines = str.split("\n");
        let anyProgressChange = false;

        for(const line of lines)
        {
            if(line.length === 0) continue;
            const lineParts = line.split(/\s+/).filter(part => part.length > 0);
            if(lineParts.length == 0) continue;

            try
            {

                const knownDatabaseName = this.mongoDatabaseAccess.databaseName;

                let result: {
                    backedUpDocCount: number,
                    totalDocCount: number,
                    percent: number,
                    collectionName: string,
                } | undefined = undefined;

                // Example line: 
                // "2024-08-05T18:28:42.444+1000    [........................]     db-name.col-name  0/294  (0.0%)"
                if(line.includes("[") && line.includes("]"))
                {
                    const rawDateTime = lineParts[0];
                    const rawProgressBar = lineParts[1];
                    const rawDbAndCollection = lineParts[2];
                    const rawDocCount = lineParts[3];
                    const rawDocCountParts = rawDocCount.split("/");
                    const rawPercent = lineParts[4].slice(1, -2);

                    const backedUpDocCount = parseInt(rawDocCountParts[0]);
                    const totalDocCount = parseInt(rawDocCountParts[1]);
                    const percent = parseFloat(rawPercent);
                    const collectionName = rawDbAndCollection.slice(knownDatabaseName.length + 1);

                    result = {
                        backedUpDocCount,
                        totalDocCount,
                        percent,
                        collectionName,
                    };
                }
                // Example line:
                // "2024-08-05T18:28:42.313+1000    done dumping db-name.col-name (987 documents)"
                else if(line.includes("done dumping"))
                {
                    const rawDateTime = lineParts[0];
                    const rawDbAndCollection = lineParts[3];
                    const rawDocCount = lineParts[4].slice(1);
                    
                    const collectionName = rawDbAndCollection.slice(knownDatabaseName.length + 1);
                    const backedUpDocCount = parseInt(rawDocCount);
                    
                    result = {
                        backedUpDocCount,
                        totalDocCount: backedUpDocCount,
                        percent: 100,
                        collectionName,
                    };
                }
                
                if(result) {

                    anyProgressChange = true;

                    const entry = this.perCollectionProgress.find(c => c.name === result.collectionName);
                    if(entry)
                    {
                        entry.backedUpCount = result.backedUpDocCount;
                        entry.totalCount = result.totalDocCount;
                    }
                }
            }
            catch (e){
                console.error("Failed to parse mongodump output line (ignoring):", lineParts);
                console.error(e);
            }
        }

        if(anyProgressChange) {

            const totalDocs = this.perCollectionProgress.reduce((acc, c) => acc + c.totalCount, 0);
            const backedUpDocs = this.perCollectionProgress.reduce((acc, c) => acc + c.backedUpCount, 0);
            const allDone = this.perCollectionProgress.every(c => c.backedUpCount === c.totalCount);

            this.onProgress({
                current: backedUpDocs,
                total: totalDocs,
            });
        }
    }
}

export async function getCollectionMetadata(databaseAccess: MongoDatabaseAccess) {

    const client = await MongoClient.connect(databaseAccess.connectionUri, {
        connectTimeoutMS: 2000,
        serverSelectionTimeoutMS: 2000
    });
    
    try
    {
        const collectionsResult = await client.db(databaseAccess.databaseName).collections();
        const output = [];
        for(const collection of collectionsResult)
        {
            output.push({ 
                name: collection.collectionName,
                totalCount:  await collection.estimatedDocumentCount()
            });
        }

        return output;
    }
    finally
    {
        await client.close();
    }    
}

const execPromise = promisify(exec);
export enum BackupCompressionFormat
{
    ZStandard = 'zst',
    Gzip = 'gz'
}

export class Compression 
{
    private static availableFormatsCache: BackupCompressionFormat[] | null = null;

    static async determineAvailableFormats(): Promise<BackupCompressionFormat[]> {

        if(this.availableFormatsCache) {
            return this.availableFormatsCache;
        }

        const availableTools: BackupCompressionFormat[] = [];
    
        try {
            await execPromise('zstd --version');
            availableTools.push(BackupCompressionFormat.ZStandard);
        } catch (error) {}
    
        availableTools.push(BackupCompressionFormat.Gzip);
    
        this.availableFormatsCache =  availableTools;
        return availableTools;
    }

    static formatFromExtension(extensionOrPath: string): BackupCompressionFormat {

        let extension = extensionOrPath;

        if(extensionOrPath.includes('.')) {
            extension = extensionOrPath.split('.').pop()!;
        }
        
        switch(extension) {
            case 'zst': return BackupCompressionFormat.ZStandard;
            case 'gz': return BackupCompressionFormat.Gzip;
            default: throw new Error(`Unknown extension: ${extension}`);
        }
    }
}