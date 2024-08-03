'use client'

import { logout } from "@actions/auth";
import { Button, ButtonWithSpinner } from "@comp/button";
import Link from "next/link";
import { useState } from "react";

export function LogoutButton() {

    const [isLoading, setIsLoading] = useState<boolean>(false)
    
    async function onClick() {

        setIsLoading(true)
        try {
            await logout()
        }
        catch (error) {}
        finally {
        setIsLoading(false);
        }
    }

    return (
        <ButtonWithSpinner isLoading={isLoading} onClick={onClick}>
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
