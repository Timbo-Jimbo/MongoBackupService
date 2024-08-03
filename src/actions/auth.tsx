'use server'

import env from "@lib/env";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const userCookieApiKey = { 
    get() {
        return cookies().get("apiKey")?.value;
    },

    set(apiKey: string) {
        cookies().set("apiKey", apiKey, {
            maxAge: 60 * 60 * 15 // 15 minutes
        });
    },

    clear() {
        cookies().delete("apiKey");
    },

    extend() {
        const currentApiKey = this.get();
        if(currentApiKey)
            this.set(currentApiKey);
    }
}

export async function login(apiKey: string) {
    await new Promise(r => setTimeout(r, 2000));
    
    if(apiKey == env.apiKey){
        userCookieApiKey.set(apiKey);
        redirect("/");
    }
    else
    {
        return false;
    }
}

export async function logout() {
    await new Promise(r => setTimeout(r, 2000));
    
    userCookieApiKey.clear();
    redirect("/login");
}

export async function extendLogin() {
    console.log("Extending login");
    userCookieApiKey.extend();
}

export async function checkLogin() {
    return userCookieApiKey.get() == env.apiKey;
}