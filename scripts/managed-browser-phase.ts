/** A signal alone cannot finish an awaited child that ignores SIGTERM.
 * Reject the owned deadline so the caller reaches its existing kill/reap finally. */
export async function awaitOwnedBrowserPhase(ports: {
  childExited: Promise<number>;
  workerExited: Promise<number>;
  stop(): void;
  deadlineMs: number;
}) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      try {
        ports.stop();
      } catch {
        reject(Error("Owned browser phase cancellation failed"));
        return;
      }
      reject(Error("Owned browser phase deadline"));
    }, ports.deadlineMs);
  });
  try {
    return await Promise.race([
      deadline,
      ports.childExited,
      ports.workerExited.then(() => {
        throw Error("Worker exited during browser cohort");
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
