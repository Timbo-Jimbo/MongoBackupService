import { LogoutButton } from "@app/login/components";
import Image from "next/image";

export function DashboardHeader () {
    return (
        <div className="sticky top-0 z-50 bg-background/75 backdrop-blur-md shadow-md border-b-[1px] border-muted/50">
            <div className="flex items-center justify-between p-4">
                <div className="flex items-center space-x-4">
                    <Image src="/logo.svg" alt="MongoDB Logo" width={32} height={32} />
                    <div className="text-xl font-bold">Railway MongoDB Backups</div>
                    <div className="text-sm opacity-50">v0.1.0</div>
                </div>
                <LogoutButton />
            </div>
        </div>
    );
}