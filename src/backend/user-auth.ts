import env from "@lib/env";
import { cookies } from "next/headers";

export const UserAuth = { 
    
    getApiKey() {
        return cookies().get("apiKey")?.value;
    },

    setApiKey(apiKey: string) {
        cookies().set("apiKey", apiKey, {
            maxAge: 60 * 60 * 15 // 15 minutes
        });
    },

    isAuthenticated() {
        return this.getApiKey() == env.apiKey;
    },

    clear() {
        cookies().delete("apiKey");
    },

    extend() {
        const currentApiKey = this.getApiKey();
        if(currentApiKey)
            this.setApiKey(currentApiKey);
    }
}
