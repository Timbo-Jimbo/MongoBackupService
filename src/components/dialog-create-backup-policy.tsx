import { Button } from "@comp/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@comp/dialog";
import { Input } from "@comp/input";
import { Label } from "@comp/label";
import { ClockIcon, CommandLineIcon, ExclamationTriangleIcon, InformationCircleIcon, PlusIcon } from "@heroicons/react/20/solid";
import cronstrue from "cronstrue";
import { useEffect, useState } from "react";
import cronParser from "cron-parser"
import { timeAgoString, timeUntilString } from "@lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@comp/alert";
import { BackupMode } from "@backend/tasks/compression.enums";
import { BackupModePicker } from "./backup-mode-picker";

enum CronValidation {
  Invalid,
  TooFrequent,
  Valid
}

export function DialogCreateBackupPolicy ({
  onOpenChange,
  open,
  supportedOptions
}: {
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  supportedOptions: BackupMode[];
}) {
  const [cronValidation, setCronValidation] = useState(CronValidation.Valid);
  const [cronExpression, setCronExpression] = useState("0 10 * * MON,WED,FRI");
  const [retentionDays, setRetentionDays] = useState<number | undefined>(7);
  const [selectedMode, setSelectedMode] = useState(supportedOptions.includes(BackupMode.Balanced) ? BackupMode.Balanced : supportedOptions[0]);
  const selectedModeSupported = supportedOptions.includes(selectedMode);
  
  useEffect(() => {
    try {
      
      if(cronstrue.toString(cronExpression) == "") {
        setCronValidation(CronValidation.Invalid);
        return
      }
      
      const interval = cronParser.parseExpression(cronExpression);
      const hasNextRun = interval.hasNext();

      if(!hasNextRun) {
        setCronValidation(CronValidation.Invalid);
        return;
      }

      let lastDate = new Date();
      let sumIntervals = 0;
      let countIntervals = 0;
      interval.iterate(10, (date, index) => {
        
        if (index > 0) {
          sumIntervals += date.getTime() - lastDate.getTime();
          countIntervals++;
        }

        lastDate = date.toDate();
      });

      // Calculate average interval
      const averageInterval = sumIntervals / countIntervals;
      const averageIntervalMinutes = averageInterval / 1000 / 60;
      const averageIntervalHours = averageIntervalMinutes / 60;

      if(averageIntervalHours < 1) 
        setCronValidation(CronValidation.TooFrequent);
      else

      setCronValidation(CronValidation.Valid);
    }
    catch (e) {
      setCronValidation(CronValidation.Invalid);
    }
  }, [cronExpression]);

  let cronString = "Invalid Cron Expression";
  let nextRunDate = new Date();
  try {
    cronString = cronstrue.toString(cronExpression);
    const interval = cronParser.parseExpression(cronExpression);
    nextRunDate = interval.next().toDate();
  } catch (e) {} 

  return (
  <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Create Backup Policy</DialogTitle>
          <DialogDescription>
            How often do you want to backup your data, and how long do you want to keep your backups around?
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <div className="grid grid-cols-6 items-center gap-x-4 gap-y-2">
            <Label htmlFor="cron-expression" className="text-right">
              Interval
            </Label>
              <div className="col-span-5 relative">
                <Input
                  name="cron-expression"
                  placeholder="Cron Expression"
                  value={cronExpression}
                  autoComplete="off"
                  onChange={(e) => setCronExpression(e.target.value)}
                />
                {cronExpression && (
                  <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex gap-2 items-center text-sm text-muted-foreground">
                    Cron Expression
                  </div>
                )}
              </div>
            <Alert className="col-start-2 col-span-5" variant={cronValidation == CronValidation.Valid ? "default" : "destructive"}>
              <InformationCircleIcon className="w-4 h-4" />
              <AlertTitle>
                {cronString}
              </AlertTitle>
              <AlertDescription className="flex flex-row gap-2 items-center">
                {cronValidation == CronValidation.Valid && (<>
                  This means your next backup is in {timeUntilString(nextRunDate)}
                </>)}
                {cronValidation == CronValidation.Invalid && (
                  <>
                    Please enter a valid cron expression
                  </>
                )}
                {cronValidation == CronValidation.TooFrequent && (
                  <>
                    This policy runs too frequently! Please choose a less frequent interval.
                  </>
                )}
              </AlertDescription>
            </Alert>
          </div>

          <div className="grid grid-cols-6 items-center gap-4 relative">
            <Label htmlFor="retention-hours" className="text-right">
              Retention
            </Label>
              <Input
                name="retention-days"
                placeholder="Days"
                autoComplete="off"
                className="col-span-5"
                value={retentionDays}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setRetentionDays(isNaN(val) ? undefined : val);
                }}
              />
              {retentionDays !== undefined && (
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex gap-2 items-center text-sm text-muted-foreground">
                  Days
                </div>
              )}
          </div>
          <div className="grid grid-cols-6 items-start gap-4 relative">
            <Label className="text-right pt-4">
              Mode
            </Label>
              <BackupModePicker 
                selectedMode={selectedMode}
                onSelectedModeSet={setSelectedMode}
                className="col-span-5"
              />
              {!selectedModeSupported && (
                <Alert className="col-start-2 col-span-5" variant={"destructive"}>
                  <CommandLineIcon className="w-4 h-4" />
                  <AlertTitle>
                    Unsupported Mode
                  </AlertTitle>
                  <AlertDescription>
                    <p>Requires <b>zstd</b> to be installed on the server.</p>
                  </AlertDescription>
                </Alert>
              )}
          </div>
        </div>
        <DialogFooter>
          <Button disabled={cronValidation != CronValidation.Valid}><PlusIcon className="w-4 h-5 mr-2"/>Create Policy</Button>
        </DialogFooter>
      </DialogContent>
  </Dialog>
  );
}