import type { AuthClock } from "../auth/owner";
import { createAppRequests } from "./requests";
import { chatAppCurrent, type NativeChatAppOptions } from "./embedOwner";

/** Only immutable module code is shared; every eligible iframe owns its import and late result. */
export function mountDeferredChatApp(
  options: NativeChatAppOptions,
  dependencies: {
    clock?: AuthClock;
    load?: () => Promise<Pick<typeof import("./embed"), "mountNativeChatApp">>;
  } = {},
) {
  const captured: NativeChatAppOptions = { ...options, file: { ...options.file }, controls: { ...options.controls } };
  const initial = captured.room(), authority = captured.authority;
  if (!initial || !authority) return () => {};
  const roomId = initial.id, account = initial.me,
    requests = createAppRequests(dependencies.clock),
    load = dependencies.load ?? (() => import("./embed"));
  let active = true,
    configuration: NativeChatAppOptions | null = captured,
    detach: (() => void) | undefined,
    unlisten = () => {};
  const current = () => {
    const owner = configuration;
    if (!active || !owner) return false;
    const valid = chatAppCurrent(owner, roomId, account);
    return valid && active && configuration === owner;
  };
  function stop(reason?: "deny" | "fail") {
    if (!active) return;
    active = false;
    const owner = configuration, mounted = detach, unsubscribe = unlisten;
    configuration = null; detach = undefined; unlisten = () => {};
    try { unsubscribe(); }
    finally {
      requests.dispose();
      try { if (reason) owner?.controls[reason]?.(); }
      finally { if (mounted) mounted(); else owner?.controls.cancel?.(); }
    }
  }
  if (!current()) { stop(); return stop; }
  const unsubscribe = authority.listen(() => stop("deny"));
  if (active) unlisten = unsubscribe;
  else unsubscribe();
  if (current()) {
    void requests.run(() => {
      if (!current()) throw Error("App is no longer active");
      return load();
    }).then((module) => {
      if (!current() || !configuration) { stop(); return; }
      const mounted = module.mountNativeChatApp({ ...configuration, current });
      // Capture before invoking current callbacks: reentrant retirement still owns cleanup.
      if (!active) { mounted(); return; }
      detach = mounted;
      if (!current()) { stop(); return; }
      const previous = unlisten;
      unlisten = () => {};
      previous();
    }).catch(() => { if (current()) stop("fail"); else stop(); });
  } else stop();
  return stop;
}
