'use client'
import { extendLogin } from "@actions/auth";
import { useEffect } from "react";
import { useInterval } from "./use-interval";

export default function LoginExtender(
    {children}: {children: React.ReactNode}
) {
    useInterval(() => {
        extendLogin().then(() => {
            console.log("Login extended");
        });
    }, 60 * 1000 /* 1 minute */);

    return (
        <>{children}</>
    );
}