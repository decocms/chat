// The kinds of agent a machine can run (Gimenes #6232, #6283): the CLI finds which of these are installed and their
// versions, and sends them with the machine's check-in (claude_rooms). The server keeps them in machines.kinds, so
// "Adicionar agent" offers only what that machine has. Only a name and a version go up: never a path or a secret.

export const AGENT_KINDS = ["claude", "codex", "agy", "opencode"] as const;
export type AgentKind = (typeof AGENT_KINDS)[number];
/** Kind → version, as found on one machine. */
export type MachineKinds = Partial<Record<AgentKind, string>>;

/** A version as a CLI prints it, cut to its number ("2.1.332 (Claude Code)" → "2.1.332"; "opencode v2.3.0" → "2.3.0"). */
export function agentVersion(raw: string): string {
  return /\d+(?:\.\d+){0,3}(?:[-+][\w.]+)?/.exec(raw)?.[0]?.slice(0, 24) ?? "";
}

/** The kinds a check-in may carry: only known kinds, each with a short version (or "" when it printed none). null =
 *  not sent (an older CLI), so the server keeps what it had. */
export function machineKinds(raw: unknown): MachineKinds | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: MachineKinds = {};
  for (const kind of AGENT_KINDS) {
    const v = (raw as Record<string, unknown>)[kind];
    if (typeof v === "string") out[kind] = agentVersion(v);
  }
  return out;
}
