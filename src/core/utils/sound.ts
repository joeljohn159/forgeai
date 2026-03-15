import { exec } from "child_process";
import { platform } from "os";

/**
 * Play a system notification sound (fire-and-forget).
 * Skips silently if not a TTY or if the sound command fails.
 */
export function playSound(): void {
  if (!process.stdout.isTTY) return;

  try {
    switch (platform()) {
      case "darwin":
        exec("afplay /System/Library/Sounds/Blow.aiff", () => {});
        break;
      case "win32":
        exec(
          "powershell -NoProfile -NonInteractive -Command \"[System.Media.SystemSounds]::Exclamation.Play()\"",
          { shell: "cmd.exe" },
          () => {},
        );
        break;
      case "linux":
        exec(
          "paplay /usr/share/sounds/freedesktop/stereo/complete.oga",
          (err) => {
            // Fallback to terminal bell if paplay fails
            if (err) process.stdout.write("\x07");
          },
        );
        break;
      default:
        // Terminal bell as universal fallback
        process.stdout.write("\x07");
    }
  } catch {
    // Silently ignore — sound is non-critical
  }
}
