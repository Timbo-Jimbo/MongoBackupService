import { UserAuth } from '@backend/user-auth';
import { mockDelay } from '@lib/utils';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

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

export function censorMongoDbConnectionUri(url: string): string {
  // Regular expression to match MongoDB connection URL
  const regex = /^(mongodb(?:\+srv)?:\/\/)([^:]+):([^@]+)@(.+)$/;

  // Replace auth details with asterisks
  return url.replace(regex, (_, protocol, username, password, rest) => {
    const censoredUsername = username.length > 3 
      ? username.slice(0, 3) + '*'.repeat(username.length - 3)
      : '*'.repeat(username.length);
    
    const censoredPassword = '*'.repeat(password.length);

    return `${protocol}${censoredUsername}:${censoredPassword}@${rest}`;
  });
}
