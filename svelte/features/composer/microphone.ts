import type { SpeechClock } from "./speech";
export const FIRE_HOLD_MS = 3000;
export const FIRE_CHARGE_MS = 400;
/** A pointer tap toggles dictation; a held gesture arms Fire exactly once.
 * Finite charge steps use owned classes/ARIA, never first-party CSS geometry. */
export function createMicrophoneGesture(options: {
  clock: SpeechClock;
  current(): boolean;
  recording(): boolean;
  start(): void;
  stop(): void;
  fireLive(): boolean;
  stopFire(): void;
  armFire(): void;
  charge(step: number | null): void;
}) {
  let active = true, generation = 0, pointer: number | null = null, fired = false;
  const timers = new Set<unknown>();
  const current = (ticket: number) => active && generation === ticket && options.current();
  function clear() { for (const timer of timers) options.clock.cancel(timer); timers.clear(); }
  function cancel() { generation++; pointer = null; fired = false; clear(); options.charge(null); }
  function later(ms: number, ticket: number, run: () => void) {
    const timer = options.clock.schedule(() => { timers.delete(timer); if (current(ticket)) run(); }, ms); timers.add(timer);
  }
  function toggle() {
    if (!active || !options.current()) return;
    if (options.fireLive()) options.stopFire();
    else if (options.recording()) options.stop();
    else options.start();
  }
  return {
    begin(id: number) {
      if (!active || !options.current()) return;
      const ticket = generation + 1;
      cancel();
      if (!current(ticket)) return;
      pointer = id;
      if (options.fireLive()) { fired = true; options.stopFire(); return; }
      for (let step = 0; step < 6; step++) later(FIRE_CHARGE_MS + step * 500, ticket, () => options.charge(step));
      later(FIRE_HOLD_MS, ticket, () => {
        fired = true; clear(); options.charge(null);
        if (!current(ticket)) return;
        options.stop();
        if (current(ticket)) options.armFire();
      });
    },
    end(id: number) {
      if (pointer !== id) return;
      const ticket = generation, held = fired;
      pointer = null; clear(); options.charge(null);
      if (current(ticket) && !held) toggle();
    },
    cancel,
    toggle,
    dispose() { active = false; cancel(); },
  };
}
