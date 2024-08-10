'use client'

import { login } from "@actions/auth";
import { LoginForm } from "./login-form";
import { Alert, AlertTitle, AlertDescription } from "@comp/alert";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ExclamationTriangleIcon } from "@heroicons/react/20/solid";

export default function LoginPage() {

  const searchParams = useSearchParams();
  const router = useRouter();

  const redirect = searchParams.get("redirect");
  const loginPrompt = searchParams.get("login-prompt") && redirect !== "/";

  const [loginFailed, setLoginFailed] = useState(false);

  const onLogin = async (apiKey: string) => {
    const loginResult = await login(apiKey, redirect);
    if(!loginResult.success) setLoginFailed(true);
    else router.push(loginResult.redirect);
  }

  return (
    <main className="flex flex-grow justify-center place-items-center">
      <div className="flex flex-col place-items-center gap-4 w-full sm:max-w-sm p-4">
        {loginPrompt && (
          <Alert variant={"destructive"}>
            <ExclamationTriangleIcon className="h-4 w-4" />
            <AlertTitle>Unauthorized</AlertTitle>
            <AlertDescription>
              Please login to view this page.
            </AlertDescription>
          </Alert>
        )}
        <LoginForm onLogin={onLogin} loginErrorVisible={loginFailed} />
      </div>
    </main>
  );
}
