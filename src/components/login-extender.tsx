'use client'

import { extendAnyLogin } from "@actions/auth";
import { useInterval } from "../lib/use-interval";

export default function LoginExtender(
    {children}: {children: React.ReactNode}
) {
    useInterval(() => {
        extendAnyLogin().then(() => {
            console.log("Login extended");
        });
    }, 60 * 1000 /* 1 minute */);

    return (
        <>{children}</>
    );
}