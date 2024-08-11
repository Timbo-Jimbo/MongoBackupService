import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import env from "./env"
import humanizeDuration from "humanize-duration";

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

export function timeAgoString(time: Date) {
  const msSince = Date.now() - time.getTime();
  const lessThanOneMinSince = msSince < 60000;
  return lessThanOneMinSince ? "Just now" : (humanizeDuration(msSince, {round: true, units:["y","mo","w","d", "h", "m"], largest: 1}) + " ago");
}

export function timeUntilString(time: Date) {
  const msUntil = time.getTime() - Date.now();
  return humanizeDuration(msUntil, {round: true, units:["y","mo","w","d", "h", "m"], largest: 1}) + " from now";
}

export function humanReadableEnumString(enumValue: string) {
  return enumValue.toString().replace("_", " ");
}