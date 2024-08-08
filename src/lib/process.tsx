import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { runAndForget } from "./utils";

type CancelSignal = {
    onCancel?: (reason?: any) => void;
}

export type ProcessSpawnInfo = {
    command: string;
    args: string[];
    stdout?: (data: Buffer) => void | null;
    stderr?: (data: Buffer) => void | null;
}

export class ProcessCancelledError extends Error {
    constructor() {
        super("Command was cancelled");
    }
}

export const runProcess = async (startInfo: ProcessSpawnInfo, cancellationCheck?: () => Promise<void> | undefined): Promise<void> => {
    await runProcessesPiped([startInfo], cancellationCheck);
}

export const runProcessesPiped = async (startInfos: ProcessSpawnInfo[], cancellationCheck?: () => Promise<void> | undefined ): Promise<void> => {
    const process: ChildProcessWithoutNullStreams[] = [];

    for(let i = 0; i < startInfos.length; i++) {
        const startInfo = startInfos[i];
        const processInstance = spawn(startInfo.command, startInfo.args);
        process.push(processInstance);

        if(i > 0) {
            process[i - 1].stdout?.pipe(processInstance.stdin);
        }

        if(startInfo.stdout) {
            processInstance.stdout?.on('data', startInfo.stdout);
        }

        if(startInfo.stderr) {
            processInstance.stderr?.on('data', startInfo.stderr);
        }
    }

    const cancelSignal: CancelSignal = {};
    let stopMonitoringForCancellation = false;
    runAndForget(async () => {
        while(cancellationCheck && !stopMonitoringForCancellation) {
            try {
                await cancellationCheck();
                await new Promise<void>(resolve => setTimeout(resolve, 500));
            }
            catch (e) {
                if(cancelSignal.onCancel)
                    cancelSignal.onCancel(e);
                break;
            }
        }
    });

    await new Promise<void>((resolve, reject) => {

        const cleanUpAll = () => {
            process.forEach(p => p.removeListener('close', onClose));
            process.forEach(p => p.kill());
            cancelSignal.onCancel = undefined;
            stopMonitoringForCancellation = true;
        }

        const onCancel = (reason?: any) => {
            cleanUpAll();
            reject(reason || new ProcessCancelledError());
        }

        const onClose = (code: number) => {
            if(code === 0) {
                resolve();
            } else {
                reject(new Error(`Process exited with code ${code}`));
            }
        };

        process[process.length - 1].on('close', onClose);
        process[process.length - 1].on('error', (error) => {
            cleanUpAll();
            reject(error);
        });

        cancelSignal.onCancel = onCancel;
    });
}