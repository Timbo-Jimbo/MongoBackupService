'use server'

import { validAuthOrRedirect } from "@actions/utils";
import { redirect } from "next/navigation";

export default async function RootPage() {

  validAuthOrRedirect('/dashboard');
  redirect("/dashboard");
}
