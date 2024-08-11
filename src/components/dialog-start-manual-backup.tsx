import { BackupMode } from "@backend/tasks/compression.enums";
import { Button } from "@comp/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@comp/dialog";
import { Progress } from "@comp/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@comp/tabs";
import { CommandLineIcon, ExclamationTriangleIcon, PlayIcon } from "@heroicons/react/20/solid";
import { cn } from "@lib/utils";
import { useState } from "react";
import { BackupModePicker } from "./backup-mode-picker";

type ProfilingData = {
    backupMode: BackupMode;
    backupTime: number;
    size: number;
}

class ProfilingRange {
    min: number;
    max: number;

    private constructor(min: number, max: number) {
        this.min = min;
        this.max = max;
    }

    static calculate(data: number[], paddingPercentage: number = 0) {
        const min = Math.min(...data);
        const max = Math.max(...data);
        const range = max - min;
        const padding = range * paddingPercentage;
        return new ProfilingRange(min - padding, max + padding);
    }

    getPercentageRange(value: number) {
        return (value - this.min) / (this.max - this.min);
    }
}

export const DialogStartManualBackup = ({
    supportedOptions,
    onBackupModeSelected,
    open,
    onOpenChange
}: {
    supportedOptions: BackupMode[];
    onBackupModeSelected: (mode: BackupMode) => void;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) => {

    const [selectedMode, setSelectedMode] = useState(supportedOptions.includes(BackupMode.Balanced) ? BackupMode.Balanced : supportedOptions[0]);
    const selectedModeSupported = supportedOptions.includes(selectedMode);

    return (
        <Dialog onOpenChange={onOpenChange} open={open}>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>Select Backup Mode</DialogTitle>
                    <DialogDescription>
                        Faster, smaller or maybe something in between?
                    </DialogDescription>
                </DialogHeader>
                <BackupModePicker selectedMode={selectedMode} onSelectedModeSet={setSelectedMode} />
                <DialogFooter>
                    {!selectedModeSupported && (
                        <div className="text-sm flex gap-2 place-items-center w-full px-2 rounded-md border border-red-800 bg-destructive">
                            <CommandLineIcon className="w-4 h-4" />
                            <p>Requires <b>zstd</b> to be installed on the server.</p>
                        </div>
                    )}
                    <Button onClick={() => onBackupModeSelected(selectedMode)} disabled={!selectedModeSupported}><PlayIcon className="w-4 h-5 mr-2"/> Start Backup</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};