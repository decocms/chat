import { writable } from "svelte/store";
import type { StudioProjectsResult } from "../../../shared/schemas";
import { createAgentLease, agentClock, type AgentClock } from "../agents/lease";
import { AGENT_REQUEST_TIMEOUT } from "../agents/model";
export type StudioProject = StudioProjectsResult["projects"][number];
export type StudioProjectsState = {
  /** The organization these projects belong to ("" = none picked yet). */
  org: string;
  phase: "idle" | "loading" | "ready" | "error";
  projects: readonly StudioProject[];
};
const blank = (): StudioProjectsState => ({
  org: "",
  phase: "idle",
  projects: [],
});
/**
 * The projects of the Studio organization picked in "Criar agent do Studio". The server reads them with the
 * person's Studio grant, as it reads the organizations. A new pick cancels the read of the one before, and an
 * organization that was read already shows at once (each pick still reads it again).
 */
export function createStudioProjects(
  load: (org: string, signal: AbortSignal) => Promise<StudioProjectsResult>,
  clock: AgentClock = agentClock,
) {
  const state = writable<StudioProjectsState>(blank()),
    lease = createAgentLease(clock),
    seen = new Map<string, readonly StudioProject[]>();
  let active = true,
    org = "",
    ticket = 0;
  function pick(next: string) {
    if (!active) return;
    org = next;
    const mine = ++ticket;
    if (!next) {
      lease.cancel();
      state.set(blank());
      return;
    }
    const known = seen.get(next);
    state.set({
      org: next,
      phase: known ? "ready" : "loading",
      projects: known ?? [],
    });
    lease
      .run((signal) => load(next, signal), AGENT_REQUEST_TIMEOUT)
      .then(
        (result) => {
          if (!active || mine !== ticket) return;
          seen.set(next, result.projects);
          state.set({ org: next, phase: "ready", projects: result.projects });
        },
        () => {
          if (!active || mine !== ticket) return;
          state.set({
            org: next,
            phase: known ? "ready" : "error",
            projects: known ?? [],
          });
        },
      );
  }
  return {
    state,
    pick,
    retry: () => pick(org),
    dispose() {
      active = false;
      ticket++;
      lease.cancel();
      seen.clear();
    },
  };
}
export type StudioProjects = ReturnType<typeof createStudioProjects>;
/** The pickers' search: every word typed is in the name, without case or accents. Combobox's fuzzy default
 *  matches scattered letters, which lists most names once an organization has dozens of projects. */
export function nameMatch(value: string, search: string) {
  const fold = (text: string) =>
    text
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();
  const name = fold(value);
  return fold(search)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => name.includes(word))
    ? 1
    : 0;
}
