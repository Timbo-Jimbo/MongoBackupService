'use client'

import { login } from "@actions/auth";
import { LoginForm } from "./login-form";

export default function Login() {

  const onLogin = async (apiKey: string) => {
    console.log("Calling login action");
    const result = await login(apiKey);
    console.log("Login result:", result);
  }

  return (
    <main className="flex min-h-screen flex-col place-items-center justify-center p-24">
      
      <div className="flex place-items-center">
        <LoginForm onLogin={onLogin} />
      </div>

    </main>
  );
}
