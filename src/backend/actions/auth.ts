'use server'

import { UserAuth } from "@backend/user-auth";
import env from "@lib/env";
import { mockDelay } from "@lib/utils";
import { redirect } from "next/navigation";

export const login = async (apiKey: string, redirectPath?: string | null) => {

    await mockDelay();
    
    if(apiKey == env.apiKey){
        UserAuth.setApiKey(apiKey);
        redirect(redirectPath || "/");
    }
    else
    {
        return false;
    }
};

export const extendAnyLogin = async () => {
    UserAuth.extend();
};

export const logout = async () => {
    await mockDelay();
    
    UserAuth.clear();
    redirect("/login");
};

export const checkLogin = async () => {
    return UserAuth.isAuthenticated();
}