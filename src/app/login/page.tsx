'use client'

import { login } from "@actions/auth";
import { LoginForm } from "./login-form";
import { Alert, AlertTitle, AlertDescription } from "@comp/alert";
import { ExclamationTriangleIcon, InfoCircledIcon } from "@radix-ui/react-icons";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

export default function Login() {

  const searchParams = useSearchParams();

  const redirect = searchParams.get("redirect");
  const loginPrompt = searchParams.get("login-prompt") && redirect !== "/";

  const [loginFailed, setLoginFailed] = useState(false);

  const onLogin = async (apiKey: string) => {
    const result = await login(apiKey, redirect);
    if(!result) setLoginFailed(true);
  }

  return (
    <main className="flex min-h-screen flex-col place-items-center justify-center p-24">
      
      <div className="flex flex-col place-items-center gap-4">
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
