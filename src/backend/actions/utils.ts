import { UserAuth } from "@backend/user-auth";
import { mockDelay } from "@lib/utils";
import { requestAsyncStorage } from "next/dist/client/components/request-async-storage-instance";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

type ServerAction<T extends any[], R> = (...args: T) => Promise<R>;
type Maybe<R> = R | undefined;

export function withAuthOrRedirect<T extends any[], R>(
  action: ServerAction<T, R>
): ServerAction<T, Maybe<R>> {
  return async (...args: T): Promise<Maybe<R>> => {
    
    validAuthOrRedirect();      
    await mockDelay();
    return action(...args);
  };
}

export function validAuthOrRedirect(redirectTo?: string | undefined) {

  if(!UserAuth.isAuthenticated()) {
      
    const searchParams = new URLSearchParams();
    searchParams.set("login-prompt", "true");

    if(!redirectTo) {
      
      const headerUrl = headers().get("x-url");
      const headerOrigin = headers().get("x-origin");        
      const pathWithParams = headerUrl?.substring(headerOrigin?.length || 0);
      redirectTo = pathWithParams;
    }

    if(redirectTo && redirectTo !== "/") 
      searchParams.set("redirect", redirectTo);

    redirect("/login?" + searchParams.toString());
  }
}