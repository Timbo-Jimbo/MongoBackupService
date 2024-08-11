import { BackupMode } from "@backend/tasks/compression.enums";
import { Button } from "@comp/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@comp/dialog";
import { Progress } from "@comp/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@comp/tabs";
import { CommandLineIcon, ExclamationTriangleIcon, PlayIcon } from "@heroicons/react/20/solid";
import { cn } from "@lib/utils";
import { useState } from "react";

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

export const DialogBackupModeSelect = ({
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

    // Just from some testing that i did..!
    // its all just for an approximation, to give
    // the user an idea of what they are selecting
    const profilingData = [
        { 
            backupMode: BackupMode.Gzip,
            size: 636,
            backupTime: 14.5
        },
        { 
            backupMode: BackupMode.FasterBackup,
            size: 381,
            backupTime: 6.5
        },
        { 
            backupMode: BackupMode.Balanced,
            size: 309,
            backupTime: 13.8
        },
        { 
            backupMode: BackupMode.SmallerBackup,
            size: 292,
            backupTime: 28.8
        },
    ];

    const sizeRange = ProfilingRange.calculate(profilingData.map(x => x.size), 0.1);
    const sizeOfSelectedMode = profilingData.find(x => x.backupMode === selectedMode)?.size ?? sizeRange.min;

    const timeRange = ProfilingRange.calculate(profilingData.map(x => x.backupTime), 0.1);
    const timeOfSelectedMode = profilingData.find(x => x.backupMode === selectedMode)?.backupTime ?? timeRange.min;
    
    const badColorHue = -10
    const goodColorHue = 120;
    const saturation = 80;
    const luminance = 30;

    const sizeHue = (1-sizeRange.getPercentageRange(sizeOfSelectedMode)) * (goodColorHue - badColorHue) + badColorHue;
    const timeHue = (1-timeRange.getPercentageRange(timeOfSelectedMode)) * (goodColorHue - badColorHue) + badColorHue;

    return (
        <Dialog onOpenChange={onOpenChange} open={open}>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>Select Backup Mode</DialogTitle>
                    <DialogDescription>
                        Faster, smaller or maybe something in between?
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col">
                    <Tabs defaultValue={selectedMode} onValueChange={newValue => setSelectedMode(newValue as BackupMode)} autoFocus={false} className="flex flex-col gap-4">
                        <TabsList className="w-full relative h-12">
                            <div className="inline-flex h-12 items-center justify-center p-1 absolute left-0 top-0 bg-none">
                                <TabsTrigger value={BackupMode.Gzip} className={cn([selectedMode === BackupMode.Gzip && "opacity-100" || "opacity-50 ", "text-lg inline"])}>GZip</TabsTrigger>
                            </div>
                            <TabsTrigger value={BackupMode.FasterBackup} className="text-lg">Faster</TabsTrigger>
                            <TabsTrigger value={BackupMode.Balanced} className="text-lg">Balanced</TabsTrigger>
                            <TabsTrigger value={BackupMode.SmallerBackup} className="text-lg">Smaller</TabsTrigger>
                        </TabsList>
                        <div className="grid grid-cols-8 gap-4 justify-items-end items-center">
                            <span className="col-span-1">Time</span>
                            <Progress className="col-span-7" indicatorClassName="opacity-75" style={{ "backgroundColor": `hsl(${timeHue}, ${saturation}%, ${luminance}%)` }} value={timeRange.getPercentageRange(timeOfSelectedMode) * 100} max={100} />
                            <span className="col-span-1">Size</span>
                            <Progress className="col-span-7" indicatorClassName="opacity-75" style={{ "backgroundColor": `hsl(${sizeHue}, ${saturation}%, ${luminance}%)` }} value={sizeRange.getPercentageRange(sizeOfSelectedMode) * 100} max={100} />
                        </div>
                        <TabsContent value={BackupMode.Gzip} className="text-sm text-muted-foreground place-items-center m-0">
                            <div className="flex flex-col place-items-center justify-center">
                                <p>
                                <ExclamationTriangleIcon className="w-4 h-4 mr-1 inline-block" />
                                <b>For compatibility</b>
                                <ExclamationTriangleIcon className="w-4 h-4 ml-1 inline-block" />
                                </p>
                                <p>Use one of the other options if you can!</p>
                            </div>
                        </TabsContent>
                        <TabsContent value={BackupMode.FasterBackup} className="text-sm text-muted-foreground m-0">
                            <div className="flex flex-col place-items-center">
                                <p>
                                    <b>Backup, PRONTO!</b>
                                </p>
                                <p>Faster backups at the cost of disk space.</p>
                            </div>
                        </TabsContent>
                        <TabsContent value={BackupMode.Balanced} className="text-sm text-muted-foreground place-items-center m-0">
                            <div className="flex flex-col place-items-center">
                                <p>
                                    <b>I want it all!</b>
                                </p>
                                <p>Well, you can't have that. But this mode strikes a nice balance.</p>
                            </div>
                        </TabsContent>
                        <TabsContent value={BackupMode.SmallerBackup} className="text-sm text-muted-foreground place-items-center m-0">
                            <div className="flex flex-col place-items-center">
                                <p>
                                    <b>"I'll probably never need this..."</b>
                                </p>
                                <p>Smallest size, but the backup will take a long time to create and restore.</p>
                            </div>
                        </TabsContent>
                    </Tabs>

                </div>
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