import { LogoutButton } from "@app/login/components";
import Image from "next/image";

export function DashboardHeader () {
    return (
        <div className="sticky top-0 z-50 backdrop-blur-md shadow-lg pb-[2px] bg-gradient-to-r from-emerald-500/10 to-slate-800/40">
            <div className="bg-black/50 flex items-center justify-between p-4">
                <div className="flex items-center space-x-4">
                    <Image src="/logo.svg" alt="MongoDB Logo" width={32} height={32} />
                    <div className="text-xl font-bold hidden sm:inline-flex">Railway MongoDB Backups</div>
                    <div className="text-sm text-muted-foreground  hidden sm:inline-flex">v0.1.0</div>
                </div>
                <LogoutButton />
            </div>
        </div>
    );
}