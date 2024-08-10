import { BackupMode } from "@backend/tasks/compression.enums";
import { Button } from "@comp/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@comp/dialog";
import { Progress } from "@comp/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@comp/tabs";
import { CommandLineIcon, ExclamationTriangleIcon, PlayIcon } from "@heroicons/react/20/solid";
import { useState } from "react";

type ProfilingData = {
    backupMode: BackupMode;
    backupTime: number;
    size: number;
    restoreTime: number;
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
            size: 309,
            backupTime: 100,
            restoreTime: 100
        },
        { 
            backupMode: BackupMode.FasterBackup,
            size: 356,
            backupTime: 100,
            restoreTime: 100
        },
        { 
            backupMode: BackupMode.Balanced,
            size: 246,
            backupTime: 100,
            restoreTime: 100
        },
        { 
            backupMode: BackupMode.SmallerBackup,
            size: 192,
            backupTime: 100,
            restoreTime: 100
        },
    ];

    const sizeRange = ProfilingRange.calculate(profilingData.map(x => x.size), 0.1);
    const sizeOfSelectedMode = profilingData.find(x => x.backupMode === selectedMode)?.size ?? sizeRange.min;
    
    const badColorHue = -10
    const goodColorHue = 120;
    const saturation = 80;
    const luminance = 30;

    const sizeHue = (1-sizeRange.getPercentageRange(sizeOfSelectedMode)) * (goodColorHue - badColorHue) + badColorHue;

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
                        <TabsList className="w-full relative">
                            <TabsTrigger value={BackupMode.Gzip} className={selectedMode === BackupMode.Gzip && "opacity-100" || "opacity-25"}>GZip</TabsTrigger>
                            <TabsTrigger value={BackupMode.FasterBackup}>Faster</TabsTrigger>
                            <TabsTrigger value={BackupMode.Balanced}>Balanced</TabsTrigger>
                            <TabsTrigger value={BackupMode.SmallerBackup}>Smaller</TabsTrigger>
                        </TabsList>
                        <div className="grid grid-cols-8 gap-4 justify-items-end items-center">
                            <span className="col-span-1">Speed</span>
                            <Progress className="col-span-7" value={0} max={100} />
                            <span className="col-span-1">Size</span>
                            <Progress className="col-span-7" indicatorClassName="opacity-75" style={{ "backgroundColor": `hsl(${sizeHue}, ${saturation}%, ${luminance}%)` }} value={sizeRange.getPercentageRange(sizeOfSelectedMode) * 100} max={100} />
                        </div>
                        <TabsContent value={BackupMode.Gzip} className="text-sm text-muted-foreground place-items-center m-0">
                            <div className="flex flex-row place-items-center justify-center">
                                <ExclamationTriangleIcon className="w-4 h-4 mr-2" />
                                For compatibility. Use one of the other options if you can!
                            </div>
                        </TabsContent>
                        <TabsContent value={BackupMode.FasterBackup} className="text-sm text-muted-foreground m-0">
                            <div className="flex flex-col place-items-center">
                                In a hurry? This mode will be faster but the backup will be larger.
                            </div>
                        </TabsContent>
                        <TabsContent value={BackupMode.Balanced} className="text-sm text-muted-foreground place-items-center m-0">
                            <div className="flex flex-col place-items-center">
                                The best of both worlds. A good balance between speed and size.
                            </div>
                        </TabsContent>
                        <TabsContent value={BackupMode.SmallerBackup} className="text-sm text-muted-foreground place-items-center m-0">
                            <div className="flex flex-col place-items-center">
                                Want to save space? This mode will be slower but the backup will be smaller.
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