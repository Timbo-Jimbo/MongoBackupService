"use client"

import { MongoDatabaseCard } from "@/components/mongo-database-card";
import { addMongoDatabase, getAllMongoDatabases } from "@actions/mongo";
import { Button, ButtonWithSpinner } from "@comp/button";
import { DialogHeader, DialogFooter, Dialog, DialogTrigger, DialogContent, DialogDescription, DialogTitle } from "@comp/dialog";
import { Input } from "@comp/input";
import { Label } from "@comp/label";
import { Separator } from "@comp/separator";
import { LoadingSpinner } from "@comp/loading-spinner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { InsertMongoDatabase, MongoDatabaseCensored } from "@backend/db/mongodb-database.schema";
import { FormEvent, useState } from "react";

export function MongoDatabaseList() {

  const [addFormOpen, setAddFormOpen] = useState(false);

  const queryClient = useQueryClient();

  const getAllQueryKey = ["monogo-databases"];
  const getAllQuery = useQuery({ 
    queryKey: getAllQueryKey, 
    queryFn: async () => {
      return await getAllMongoDatabases();
    },
  });

  const addDatabaseMutation = useMutation({
    mutationFn: async (mongoDatabase: InsertMongoDatabase) => {
      return await addMongoDatabase(mongoDatabase);
    },
    onSuccess: (newMongoDatabase) => {
      queryClient.setQueryData(getAllQueryKey, (databases: MongoDatabaseCensored[]) => {
        return [...databases, newMongoDatabase];
      });
      setAddFormOpen(false);
    }
  })
  

  const isReady = getAllQuery.isFetched;
  const mongoDatabases = getAllQuery.data || [];

  return (
    <div className="flex flex-col w-full gap-4">
      <h2 className="text-xl font-semibold">Mongo Databases</h2>
      {isReady && mongoDatabases.length === 0 && <p className="opacity-50 text-sm">There are no Mongo Databases to show.</p>}
      {!isReady && (
        <div className="flex flex-col m-4 place-items-center justify-center">
          <LoadingSpinner className="w-10 h-10 opacity-50" />
        </div>
      )}
      {mongoDatabases.map((mongoDatabase, index, mongoDatabases) => (
        <div key={mongoDatabase.id}>
          <MongoDatabaseCard 
            key={mongoDatabase.id}
            mongoDatabase={mongoDatabase}
          />
          {index < mongoDatabases.length - 1 && <Separator />}
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
            
            console.log("Form Data", Object.fromEntries(formData.entries()));

            addDatabaseMutation.mutate({
              referenceName: formData.get("reference-name") as string,
              connectionUri: formData.get("mongo-connection-uri") as string,
              databaseName: formData.get("database-name") as string,
            });
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
              {/* <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="reference-color-hex" className="text-right">
                  Reference Color
                </Label>
                <Input
                  name="reference-color-hex"
                  placeholder="my-database"
                  type="hidden"
                />
                <div className="col-span-3 flex flex-row gap-2 place-content-between">
                  {["#dd1111", "#ff6600", "#ffee33", "#00d629", "#11deee"].map((color) => (
                    <div key={color} className="w-full h-6 rounded-full ring-4 ring-white">
                      <input type="radio" name="reference-color-hex" value={color} className="hidden" />
                      <div className="w-full h-full rounded-full" style={{backgroundColor: color}}></div>
                    </div>
                  ))}
                </div>
              </div> */}
            </div>
            <DialogFooter>
              <ButtonWithSpinner type="submit" isLoading={addDatabaseMutation.isPending}>Add</ButtonWithSpinner>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}