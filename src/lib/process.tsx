import { ChildProcessWithoutNullStreams, spawn } from "child_process";

export type CancelSignal = {
    onCancel?: () => void;
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

export const runProcess = async (startInfo: ProcessSpawnInfo, cancelToken: CancelSignal = { }): Promise<void> => {
    await runProcessesPiped([startInfo], cancelToken);
}

export const runProcessesPiped = async (startInfos: ProcessSpawnInfo[], cancelToken: CancelSignal = { }): Promise<void> => {
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

    await new Promise<void>((resolve, reject) => {

        const cleanUpAll = () => {
            process.forEach(p => p.removeListener('close', onClose));
            process.forEach(p => p.kill());
            cancelToken.onCancel = undefined;
        }

        const onCancel = () => {
            cleanUpAll();
            reject(new ProcessCancelledError());
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

        cancelToken.onCancel = onCancel;
    });
}