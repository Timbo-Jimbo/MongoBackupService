'use server'

import { validAuthOrRedirect } from "@actions/common";
import { redirect } from "next/navigation";

export default async function Home() {

  validAuthOrRedirect('/dashboard');
  redirect("/dashboard");
}
