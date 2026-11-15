import { test, expect } from "bun:test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { awaitOwnedBrowserPhase } from "./managed-browser-phase";

test.skipIf(process.platform !== "linux")(
  "owned deadline reaches kill/reap when the real Node child ignores TERM",
  async () => {
    const child = spawn(
      "node",
      [
        "-e",
        'process.on("SIGTERM", () => {}); process.stdout.write("ready\\n"); setInterval(() => {}, 1000);',
      ],
      { detached: true, stdio: ["ignore", "pipe", "ignore"] },
    );
    const pid = child.pid;
    if (!pid || !child.stdout) throw Error("Owned child did not start");
    const exited = once(child, "exit");
    let readyTimer: ReturnType<typeof setTimeout> | undefined;
    let escalation: ReturnType<typeof setTimeout> | undefined;
    let reachedFinally = false,
      termSent = false;
    const started = performance.now();
    try {
      await Promise.race([
        once(child.stdout, "data"),
        new Promise<never>((_resolve, reject) => {
          readyTimer = setTimeout(
            () => reject(Error("Owned Node readiness deadline")),
            1500,
          );
        }),
      ]);
      clearTimeout(readyTimer);
      try {
        await expect(
          awaitOwnedBrowserPhase({
            childExited: exited.then(() => 0),
            workerExited: new Promise<number>(() => {}),
            stop() {
              termSent = true;
              process.kill(-pid, "SIGTERM");
            },
            deadlineMs: 100,
          }),
        ).rejects.toThrow("Owned browser phase deadline");
        expect(child.exitCode).toBe(null);
        expect(child.signalCode).toBe(null);
      } finally {
        reachedFinally = true;
        escalation = setTimeout(() => {
          if (child.exitCode === null && child.signalCode === null)
            process.kill(-pid, "SIGKILL");
        }, 100);
        await exited;
      }
      expect(termSent).toBe(true);
      expect(reachedFinally).toBe(true);
      expect(child.signalCode).toBe("SIGKILL");
      expect(performance.now() - started).toBeLessThan(3000);
      expect(() => process.kill(pid, 0)).toThrow();
    } finally {
      clearTimeout(readyTimer);
      clearTimeout(escalation);
      if (child.exitCode === null && child.signalCode === null)
        process.kill(-pid, "SIGKILL");
      await exited;
    }
  },
  4000,
);
