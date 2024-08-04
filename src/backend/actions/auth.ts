'use server'

import { UserAuth } from "@backend/user-auth";
import env from "@lib/env";
import { mockDelay } from "@lib/utils";
import { redirect } from "next/navigation";

type LoginFailResult = {
    success: false;
}

type LoginSuccessResult = {
    success: true;
    redirect: string;
}

type LoginResult = LoginFailResult | LoginSuccessResult;

export const login = async (apiKey: string, redirectPath?: string | null) : Promise<LoginResult> => {

    await mockDelay();
    
    if(apiKey == env.apiKey){
        UserAuth.setApiKey(apiKey);

        return {
            success: true,
            redirect: redirectPath || "/dashboard"
        };
    }
    else {
        return {
            success: false,
        };
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