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
  const msSinceBackup = Date.now() - time.getTime();
  const lessThanOneMinSinceBackup = msSinceBackup < 60000;
  return lessThanOneMinSinceBackup ? "Just now" : (humanizeDuration(msSinceBackup, {round: true, units:["y","mo","w","d", "h", "m"], largest: 1}) + " ago");
}