import { exec } from "child_process";
import { platform } from "os";

/**
 * Play a system notification sound (fire-and-forget).
 * Skips silently if not a TTY.
 */
export function playSound(): void {
  if (!process.stdout.isTTY) return;

  switch (platform()) {
    case "darwin":
      exec("afplay /System/Library/Sounds/Blow.aiff");
      break;
    case "linux":
      exec(
        "paplay /usr/share/sounds/freedesktop/stereo/complete.oga 2>/dev/null || printf '\\x07'"
      );
      break;
    default:
      process.stdout.write("\x07");
  }
}
