import { LogoutButton } from "@app/login/components";
import Image from "next/image";

export function GlobalFooter () {
    return (
        <footer>
            <div className="items-center justify-between p-4">
                <div className="flex flex-col justify-center place-items-center w-full">
                    <div className="text-sm text-muted-foreground/50 font-semibold">Made with love by</div>
                    <div className="text-md text-muted-foreground font-bold">
                        <a href="https://timbojimbo.com" target="_blank">Timbo Jimbo</a>
                    </div>
                </div>
            </div>
        </footer>
    );
}