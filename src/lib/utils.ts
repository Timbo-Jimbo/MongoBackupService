import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import env from "./env"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function mockDelay() {
  
  var delayMs = env.mockResponseDelay;
  if(delayMs > 0)
    await new Promise(r => setTimeout(r, delayMs));
}

export function runAndForget(action: () => Promise<void>) {
  action().catch(console.error);
}