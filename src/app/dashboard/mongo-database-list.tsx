"use client"

import { MongoDatabaseCard } from "@/components/mongo-database-card";
import { ButtonWithSpinner } from "@comp/button";
import { DialogHeader, DialogFooter, Dialog, DialogTrigger, DialogContent, DialogDescription, DialogTitle } from "@comp/dialog";
import { Input } from "@comp/input";
import { Label } from "@comp/label";
import { Separator } from "@comp/separator";
import { LoadingSpinner } from "@comp/loading-spinner";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { useMongoDatabaseListQueryClient } from "@/components/providers/mongo-database-list-query-client";

export function MongoDatabaseList() {

  const [addFormOpen, setAddFormOpen] = useState(false);
  const mongoDatbaseListQueryClient = useMongoDatabaseListQueryClient();
    
  const isReady = mongoDatbaseListQueryClient.getAllQuery.isFetched;
  const results = mongoDatbaseListQueryClient.getAllQuery.data || [];

  return (
    <div className="flex flex-col w-full gap-4">
      <h2 className="text-xl font-semibold">Mongo Databases</h2>
      {isReady && results.length === 0 && <p className="opacity-50 text-sm">There are no Mongo Databases to show.</p>}
      {!isReady && (
        <div className="flex flex-col m-4 place-items-center justify-center">
          <LoadingSpinner className="w-10 h-10 opacity-50" />
        </div>
      )}
      {results.map((result, index, results) => (
        <div key={result.mongoDatabase.id}>
          <MongoDatabaseCard 
            mongoDatabase={result.mongoDatabase}
            backupSummary={result.backupSummary}
          />
          {index < results.length - 1 && <Separator />}
        </div>
      ))}

      <Dialog open={addFormOpen} onOpenChange={setAddFormOpen}>
        <DialogTrigger asChild>
          <ButtonWithSpinner>
            Add Mongo Database
          </ButtonWithSpinner>
        </DialogTrigger>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Add Mongo Database</DialogTitle>
            <DialogDescription>
              This represents a single database within a MongoDB instance.
            </DialogDescription>
            <DialogDescription>
              Once added, you can schedule and restore backups as well as seed it from database another.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();

            const formData = new FormData(e.currentTarget);

            const toastId = toast.loading("Adding database...");

            mongoDatbaseListQueryClient.addDatabaseMutation.mutate({
              referenceName: formData.get("reference-name") as string,
              connectionUri: formData.get("mongo-connection-uri") as string,
              databaseName: formData.get("database-name") as string,
            }, {
              onSettled: () => {
                toast.dismiss(toastId);
              }
            });

            setAddFormOpen(false);
          }}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="reference-name" className="text-right">
                  Reference Name
                </Label>
                <Input
                  name="reference-name"
                  placeholder="My Database"
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="mongo-connection-uri" className="text-right">
                  Connection URI
                </Label>
                <Input
                  name="mongo-connection-uri"
                  placeholder="mongodb://user:password@host:port"
                  className="col-span-3"
                  autoComplete="off"
                  type="string"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="database-name" className="text-right">
                  Database Name
                </Label>
                <Input
                  name="database-name"
                  placeholder="my-database"
                  className="col-span-3"
                />
              </div>
            </div>
            <DialogFooter>
              <ButtonWithSpinner type="submit" isLoading={mongoDatbaseListQueryClient.addDatabaseMutation.isPending}>Add</ButtonWithSpinner>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}