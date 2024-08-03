'use server'

import { checkLogin } from "../actions/auth";
import { LoginButton, LogoutButton } from "./login/components";

export default async function Home() {

  const loggedIn = await checkLogin();

  return (
    <main className="flex min-h-screen flex-col place-items-center justify-center p-24">
      
      <div className="flex place-items-center">
        {loggedIn ? (
          <div className="flex flex-col gap-4">
            <h1>Welcome back!</h1>
            <LogoutButton />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <h1>Not logged in</h1>
            <LoginButton />
          </div>
        )}
      </div>

    </main>
  );
}
