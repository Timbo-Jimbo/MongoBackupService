"use client"

import { MongoDatabaseCard } from "@/components/mongo-database-card";
import { ButtonWithSpinner } from "@comp/button";
import { DialogHeader, DialogFooter, Dialog, DialogTrigger, DialogContent, DialogDescription, DialogTitle } from "@comp/dialog";
import { Input } from "@comp/input";
import { Label } from "@comp/label";
import { Separator } from "@comp/separator";
import { FormEvent, Fragment, useState } from "react";
import { toast } from "sonner";
import { useMongoDatabaseListQueryClient } from "@lib/providers/mongo-database-list-query-client";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@comp/card";
import { HandRaisedIcon } from "@heroicons/react/20/solid";
import { InfoCircledIcon, PlusIcon } from "@radix-ui/react-icons";
import { Alert, AlertDescription, AlertTitle } from "@comp/alert";
import { SkeletonList } from "@/components/skeleton-list";

export function MongoDatabaseList() {

  const [addFormOpen, setAddFormOpen] = useState(false);
  const mongoDatbaseListQueryClient = useMongoDatabaseListQueryClient();
    
  const isReady = mongoDatbaseListQueryClient.getAllQuery.isFetched;
  const results = mongoDatbaseListQueryClient.getAllQuery.data || [];

  return (
    <Card className="flex flex-col w-full">
      <CardHeader>
        <CardTitle className="text-xl font-bold">Mongo Databases</CardTitle>
        <CardDescription>
          Add and manage your Mongo databases.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isReady && results.length == 0 && <p className="opacity-50 text-sm"><InfoCircledIcon className="w-4 h-4 mr-2 inline" />There are no Mongo Databases to show.</p>}
        {!isReady && <SkeletonList count={0} className="h-[4.5rem]"/>}
        {results.map((result, index, results) => (
          <Fragment key={result.mongoDatabase.id}>
            <MongoDatabaseCard 
              mongoDatabase={result.mongoDatabase}
              ownBackups={result.backups}
              latestTask={result.latestTask}
              otherDatabases={results
                .filter((r) => r.mongoDatabase.id !== result.mongoDatabase.id)
                .map((r) => ({
                  mongoDatabase: r.mongoDatabase,
                  backups: r.backups,
                }))
              }
            />
            {index < results.length - 1 && <Separator className="my-4"/>}
          </Fragment>
        ))}
      </CardContent>
      <CardFooter className="flex flex-col gap-4">
        {isReady && results.length == 0 && (
          <Alert>
            <HandRaisedIcon className="w-5 h-5 mr-2 animate-hand-wave" />
            <AlertTitle>Hey there!</AlertTitle>
            <AlertDescription>Get started by registering your first database bellow.</AlertDescription>
          </Alert>
        )}
        <Dialog open={addFormOpen} onOpenChange={setAddFormOpen}>
          <DialogTrigger asChild>
            <ButtonWithSpinner className="w-full">
              <PlusIcon className="w-5 h-5 mr-2"/>
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
      </CardFooter>
    </Card>
  );
}