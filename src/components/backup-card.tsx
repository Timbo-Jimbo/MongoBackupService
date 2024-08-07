import { deleteBackup } from "@actions/backups";
import { Backup } from "@backend/db/backup.schema";
import { Button } from "@comp/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@comp/dropdown-menu";
import { toastForActionResult } from "@comp/toasts";
import { ChartPieIcon, DocumentIcon, Square3Stack3DIcon, TableCellsIcon } from "@heroicons/react/20/solid";
import { useBackupListQueryClient } from "@lib/providers/backup-list-query-client";
import { DotsVerticalIcon, TrashIcon } from "@radix-ui/react-icons";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import humanizeDuration from "humanize-duration";
import prettyBytes from "pretty-bytes"


interface TitleAndStatPassInIconProps {
  Icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  title: string;
  stat: string;
}

const TitleAndStat: React.FC<TitleAndStatPassInIconProps> = ({
  title,
  stat,
  Icon
}) => {
  return (
    <div className="flex flex-row place-items-center">
      {Icon && <Icon className="w-10 h-10 mr-3" />}
      <div className="flex flex-col gap-0">
        <span className="opacity-50 text-xs">{title}</span>
        {stat} 
      </div>
    </div>
  );
}

export function BackupCard({
  backup,
}: {
  backup: Backup,
}) {

  const backupListQueryClient = useBackupListQueryClient(); 

  const deleteBackupMutation = useMutation({
    mutationFn: async () => await deleteBackup(backup.id),
    onSuccess: (result) => {

      toastForActionResult(result);

      if(!result?.success) return;

      backupListQueryClient.notifyBackupWasDeleted(backup.id);
    }
  });

  const msSinceBackup = Date.now() - backup.createdAt.getTime();
  const lessThanOneMinSinceBackup = msSinceBackup < 60000;
  const humanizedDurationString = lessThanOneMinSinceBackup ? "Just now" : (humanizeDuration(msSinceBackup, {round: true, units:["y","mo","w","d", "h", "m"], largest: 1}) + " ago");
  
  return (
    <div className="flex flex-col my-4 gap-4">
      <div className="flex flex-row flex-grow gap-2">
        <div className="flex flex-col gap-2 w-full">
          <div className="flex flex-row gap-2 place-items-center w-full">
            <div className="flex flex-row gap-2 place-items-center w-full">
              <h1 className="text-lg font-semibold capitalize">{humanizedDurationString}</h1>
              <p className="grow text-sm opacity-50 text-right">{backup.createdAt.toLocaleString(undefined, {dateStyle: "medium", timeStyle: "short"})}</p>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant={"ghost"} size="icon">
                    <DotsVerticalIcon className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem className="bg-destructive text-destructive-foreground" onClick={() => deleteBackupMutation.mutate()} disabled={deleteBackupMutation.isPending}>
                      <TrashIcon className="w-4 h-4 mr-2" />
                      Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="flex flex-row gap-2 place-items-center my-4">
            <div className="flex flex-row w-full place-content-between ">
              <TitleAndStat title="Database Name" stat={backup.sourceMetadata.databaseName} Icon={Square3Stack3DIcon} />
              <TitleAndStat title="Documents" stat={backup.sourceMetadata.collections.reduce((acc, c) => acc + c.documentCount, 0).toLocaleString()} Icon={DocumentIcon} />
              <TitleAndStat title="Collections" stat={backup.sourceMetadata.collections.length.toLocaleString()} Icon={TableCellsIcon} />
              <TitleAndStat title="Size" stat={prettyBytes(backup.sizeBytes)} Icon={ChartPieIcon} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}