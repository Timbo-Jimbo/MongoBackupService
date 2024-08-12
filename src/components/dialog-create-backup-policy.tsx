import { Button } from "@comp/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@comp/dialog";
import { Input } from "@comp/input";
import { Label } from "@comp/label";
import { CommandLineIcon, ExclamationTriangleIcon, InformationCircleIcon, PlusIcon } from "@heroicons/react/20/solid";
import cronstrue from "cronstrue";
import { useEffect, useState } from "react";
import cronParser from "cron-parser"
import { cn, timeUntilString } from "@lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@comp/alert";
import { BackupMode } from "@backend/tasks/compression.enums";
import { BackupModePicker } from "./backup-mode-picker";

enum CronValidation {
  Invalid,
  TooFrequent,
  Valid
}

type CronValidationResult = {
  result: CronValidation;
  alertTitle: string;
  alertBody: string;
}

export function DialogCreateBackupPolicy ({
  onOpenChange,
  onCreatePolicy,
  open,
  supportedOptions
}: {
  onOpenChange?: (open: boolean) => void;
  onCreatePolicy: (referenceName: string, cronExpression: string, retentionDays: number, mode: BackupMode) => void;
  open?: boolean;
  supportedOptions: BackupMode[];
}) {

  const minimumIntervalHours = 0.5 // 30 mins
  const getCronValidationResultForCronExpression = (cronExpression: string): CronValidationResult => {
    try {
      const cronString = cronstrue.toString(cronExpression);
      if(cronString === "") {
        throw new Error("Invalid cron expression");
      }
      
      const interval = cronParser.parseExpression(cronExpression);
      const hasNextRun = interval.hasNext();

      if(!hasNextRun) {
        throw new Error("Invalid cron expression");
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

      if(averageIntervalHours < minimumIntervalHours) 
      {
        return {
          result: CronValidation.TooFrequent,
          alertTitle: "Invalid Cron Expression",
          alertBody: "This policy runs too frequently! Please choose a less frequent interval"
        }
      }
      else
      {
        interval.reset(new Date());

        return {
          result: CronValidation.Valid,
          alertTitle: cronString,
          alertBody: `This means your next backup is in ${timeUntilString(interval.next().toDate())}`
        };
      }
    }
    catch (e) {
      return {
        result: CronValidation.Invalid,
        alertTitle: "Invalid Cron Expression",
        alertBody: "Please enter a valid cron expression"
      };
    }
  };

  const defaultReferenceName = "Backup Policy";
  const defaultCronExpression = "0 10 * * MON,WED,FRI";
  const defaultRetentionDays = 7;
  const defaultMode = supportedOptions.includes(BackupMode.Balanced) ? BackupMode.Balanced : supportedOptions[0];

  const [referenceName, setReferenceName] = useState(defaultReferenceName);
  const [cronValidationResult, setCronValidationResult] = useState<CronValidationResult>(getCronValidationResultForCronExpression(defaultCronExpression));
  const [cronExpression, setCronExpression] = useState(defaultCronExpression);
  const [retentionDays, setRetentionDays] = useState<number | undefined>(defaultRetentionDays);
  const [selectedMode, setSelectedMode] = useState(defaultMode);
  
  useEffect(() => {
    if(open) {
      //reset form
      setReferenceName(defaultReferenceName);
      setCronExpression(defaultCronExpression);
      setRetentionDays(defaultRetentionDays);
      setSelectedMode(defaultMode);
    }
  }, [open]);

  useEffect(() => {
    setCronValidationResult(getCronValidationResultForCronExpression(cronExpression));
  }, [cronExpression]);

  const selectedModeSupported = supportedOptions.includes(selectedMode);
  const canCreate = referenceName.length > 0 && cronValidationResult.result == CronValidation.Valid && selectedModeSupported && retentionDays !== undefined && retentionDays > 0;

  return (
  <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-xl" onOpenAutoFocus={e => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Create Backup Policy</DialogTitle>
          <DialogDescription>
            How often do you want to backup your data, and how long do you want to keep your backups around?
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <div className={cn([
            "grid grid-cols-6 items-center gap-4 relative",
            (referenceName.length == 0 && "form-error")
          ])}>
            <Label htmlFor="reference-name" className="text-right">
              Reference Name
            </Label>
            <Input
              name="reference-name"
              placeholder="Reference Name"
              defaultValue={referenceName}
              autoComplete="off"
              className="col-span-5"
              onChange={(e) => setReferenceName(e.target.value)}
            />
            {referenceName.length == 0 && (
              <Alert className="col-start-2 col-span-5" variant={"destructive"}>
                <ExclamationTriangleIcon className="w-4 h-4" />
                <AlertTitle>
                  Required
                </AlertTitle>
                <AlertDescription>
                  <p>Please provide a reference name for this backup policy.</p>
                </AlertDescription>
              </Alert>
            )}
          </div>
          <div className={cn([
            "grid grid-cols-6 items-center gap-4 relative",
            (cronValidationResult.result != CronValidation.Valid && "form-error")
          ])}>
            <Label htmlFor="cron-expression" className="text-right">
              Interval
            </Label>
            <Input
              name="cron-expression"
              placeholder="Cron Expression"
              value={cronExpression}
              autoComplete="off"
              className="col-span-5"
              onChange={(e) => setCronExpression(e.target.value)}
            />
            {cronExpression && (
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex gap-2 items-center text-sm text-muted-foreground">
                Cron Expression
              </div>
            )}
            <Alert className="col-start-2 col-span-5" variant={cronValidationResult.result == CronValidation.Valid ? "default" : "destructive"}>
              {cronValidationResult.result === CronValidation.Valid && (
                <InformationCircleIcon className="w-4 h-4" />
              )}
              {cronValidationResult.result === CronValidation.Invalid && (
                <ExclamationTriangleIcon className="w-4 h-4" />
              )}
              <AlertTitle>
                {cronValidationResult.alertTitle}
              </AlertTitle>
              <AlertDescription className="flex flex-row gap-2 items-center">
                {cronValidationResult.alertBody}
              </AlertDescription>
            </Alert>
          </div>

          <div className={cn([
            "grid grid-cols-6 items-center gap-4 relative",
            (retentionDays === undefined && "form-error")
          ])}>
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
            {retentionDays === undefined && (
              <Alert className="col-start-2 col-span-5" variant={"destructive"}>
                <ExclamationTriangleIcon className="w-4 h-4" />
                <AlertTitle>
                  Retention Required
                </AlertTitle>
                <AlertDescription>
                  <p>Retention days must be a number greater than 0.</p>
                </AlertDescription>
              </Alert>
            )}
          </div>
          <div className={cn([
            "grid grid-cols-6 items-center gap-4 relative",
            (!selectedModeSupported === undefined && "form-error")
          ])}>
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
          <Button disabled={!canCreate} onClick={() => onCreatePolicy(referenceName, cronExpression, retentionDays ?? 1, selectedMode)}><PlusIcon className="w-4 h-5 mr-2"/>Create Policy</Button>
        </DialogFooter>
      </DialogContent>
  </Dialog>
  );
}