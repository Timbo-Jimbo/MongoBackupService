'use client'

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@comp/card"
import { ButtonWithSpinner } from "@comp/button"
import { Input } from "@comp/input"
import { Label } from "@comp/label"
import { Alert, AlertDescription, AlertTitle } from "@comp/alert"
import { InfoCircledIcon } from "@radix-ui/react-icons"
import { FormEvent, useState } from "react"

export function LoginForm(
  {onLogin}: {onLogin: (apiKey: string) => Promise<void>}
) {
  const [isLoading, setIsLoading] = useState<boolean>(false)
 
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
 
    try {
      await onLogin(event.currentTarget.apiKey?.value)
    }
    catch (error) {}
    finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4  max-w-sm">
      <form onSubmit={onSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Login</CardTitle>
            <CardDescription>
              Enter your API Key bellow to access the dashboard.
            </CardDescription>
          </CardHeader>

          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="apiKey">API Key</Label>
              <Input id="apiKey" type="password" required />
            </div>
          </CardContent>
          <CardFooter>
            <ButtonWithSpinner className="w-full" isLoading={isLoading}>
              {isLoading ? "Signing in..." : "Sign in"}
            </ButtonWithSpinner>
          </CardFooter>
        </Card>
      </form>

      <Alert>
        <InfoCircledIcon className="h-4 w-4" />
        <AlertTitle>API Key...?</AlertTitle>
        <AlertDescription>
          Your API key is defined as an environment variable on this service.
        </AlertDescription>
      </Alert>
    </div>
  )
}
