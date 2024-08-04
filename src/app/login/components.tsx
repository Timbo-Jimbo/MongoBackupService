'use client'

import { logout } from "@actions/auth";
import { Button, ButtonWithSpinner } from "@comp/button";
import Link from "next/link";
import { useCallback, useState } from "react";

export function LogoutButton() {

    const [isLoading, setIsLoading] = useState<boolean>(false)
    
    const onClickCallback = useCallback(async () => {
        setIsLoading(true)
        await logout();
        setIsLoading(false);
    },[]);

    return (
        <ButtonWithSpinner isLoading={isLoading} onClick={onClickCallback}>
            {isLoading ? "Signing out..." : "Sign out"}
        </ButtonWithSpinner>
    );
}

export function LoginButton()
{
    return (
        <Button><Link href="/login">Sign in</Link></Button>
    );
}
