<script lang="ts">
  import { onDestroy, untrack, type Snippet } from "svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import Switch from "../../lib/studio/Switch.svelte";
  import Button from "../../lib/studio/Button.svelte";
  import Popover from "../../lib/studio/Popover.svelte";
  import PopoverContent from "../../lib/studio/PopoverContent.svelte";
  import PopoverTrigger from "../../lib/studio/PopoverTrigger.svelte";
  import { cn } from "../../lib/studio/utils";
  import { settingsHref } from "../account/settings";
  import { prettyModel } from "../chat/model";
  import type { RoomAgentSession } from "./room";
  import {
    agentMark,
    agentPresence,
    agentStatus,
    connectPrompt,
  } from "./model";
  import { runnerPath } from "./runner";
  import {
    AGENT_TILES,
    agentMark as AGENT_MARK_OF,
    agentProvider,
  } from "../../lib/components/agent";
  import { roomAgentText, type RoomAgentCopyKey } from "./roomCopy";
  import type { AgentsResult, RoomMachine } from "../../../shared/schemas";
  /**
   * Your Claude at the foot of the room's sidebar (desktop), in one row: is it answering here, and the switch that
   * turns it on or off for this room (every machine of yours). The row opens the rest: your machines and the Claudes
   * listening on them, how to bring a computer back, and the ways to add an agent. With none yet, the row says so
   * and connects.
   */
  let {
    owner,
    onopen,
    origin,
    lang = "pt",
    queue = [],
    ago = (ts: number) => new Date(ts).toLocaleTimeString(),
  }: {
    owner: RoomAgentSession;
    onopen(): void;
    origin: string;
    lang?: "pt" | "en";
    queue?: readonly { phase: string | null }[];
    ago?: (ts: number) => string;
  } = $props();
  type Agent = AgentsResult["agents"][number];
  const view = untrack(() => owner.state),
    runner = untrack(() => owner.runner.state);
  const text = (
    key: RoomAgentCopyKey,
    vars?: Record<string, string | number>,
  ) =>
    roomAgentText(lang, key).replace(/\{(\w+)\}/g, (_, k) =>
      String(vars?.[k] ?? ""),
    );
  const data = $derived($view.data);
  const presence = $derived(agentPresence(data, owner.account, $view.now));
  const status = $derived(
    agentStatus(presence, $view.hasAgent, $view.askedAt, $view.now),
  );
  const mark = $derived(agentMark(status, queue));
  const path = $derived(runnerPath($runner.where));
  const machines = $derived(data?.machines ?? []);
  const mine = $derived(
    (data?.agents ?? []).filter((a) => a.email === owner.account),
  );
  /** The Claudes of a machine that are listening now (the ones that stopped are not listed). */
  const liveOf = (m: RoomMachine) =>
    mine.filter((a) => a.machine === m.id && a.listening);
  const anyOn = $derived(machines.some((m) => m.on));
  const empty = $derived(!machines.length);
  const live = $derived(
    mine.filter(
      (a) => a.listening && machines.some((m) => m.id === a.machine && m.on),
    ),
  );
  type Foot =
    "none" | "off" | "working" | "listening" | "opening" | "down" | "paused";
  const foot = $derived.by((): Foot => {
    if (empty) return "none";
    const on = machines.filter((m) => m.on);
    if (!on.length) return "off";
    if (live.length) return mark.state === "busy" ? "working" : "listening";
    if (on.some((m) => m.online)) return "opening";
    return on.some((m) => m.kind !== "sandbox") ? "down" : "paused";
  });
  const DOT: Record<Foot, string> = {
    none: "",
    off: "bg-muted-foreground",
    working: "bg-brand",
    listening: "bg-brand",
    opening: "bg-warning",
    down: "bg-warning",
    paused: "bg-muted-foreground",
  };
  const percent = (a: Agent) =>
    a.context ? Math.round((a.context.tokens / a.context.window) * 100) : null;
  const summary = $derived.by(() => {
    switch (foot) {
      case "none":
        return text("hereNone");
      case "off":
        return text("hereOff");
      case "working":
        return text("hereWorking");
      case "listening": {
        const p = live.length === 1 ? percent(live[0]!) : null;
        return p === null
          ? text("footListening")
          : `${text("footListening")} · ${p}%`;
      }
      case "opening":
        return text("footOpening");
      case "down":
        return text("hereDown");
      case "paused":
        return text("footPaused");
      default: {
        const never: never = foot;
        return never;
      }
    }
  });
  /** A computer that reports an address for a name (192.168.…) reads as "Computer". */
  const machineName = (m: RoomMachine) =>
    /^\d{1,3}(\.\d{1,3}){3}$|^localhost$/i.test(m.name)
      ? text("computer")
      : m.name;
  const machineLine = (m: RoomMachine, open: number) =>
    !m.on
      ? text("hereOff")
      : !m.online
        ? m.kind === "sandbox"
          ? text("footPaused")
          : `${text("footOffline")}${m.seen_at ? ` · ${ago(m.seen_at)}` : ""}`
        : open
          ? m.kind !== "sandbox" && $runner.available && path
            ? path
            : text("footOnline")
          : text("noneOpen");
  const who = (a: Agent) =>
    `${(prettyModel(a.who) || "Agent").replace(/^Claude\s+/i, "")}${a.name ? ` @${a.name}` : ""}${a.room || a.repo ? ` · ${a.room || a.repo}` : ""}`;
  const install = $derived(`curl -fsSL ${origin}/setup.sh | sh`);
  const cloud = $derived(settingsHref("cloud", owner.roomId));
  const TILE =
    "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-0 bg-muted px-1.5 py-3 text-center font-sans text-foreground no-underline transition-[background-color,transform] duration-150 hover:bg-accent active:scale-[0.97] motion-reduce:active:scale-100";
  let more = $state(false),
    open = $state(false),
    copied = $state(""),
    timer: ReturnType<typeof setTimeout> | undefined,
    active = true;
  async function copy(key: string, value: string) {
    if (!active || !owner.current()) return;
    try {
      await navigator.clipboard.writeText(value);
      if (active) copied = key;
    } catch {
      if (active) copied = `fail:${key}`;
    }
    clearTimeout(timer);
    timer = setTimeout(() => (copied = ""), 1500);
  }
  const label = (key: string, fallback: string) =>
    copied === key
      ? `✓ ${roomAgentText(lang, "copied")}`
      : copied === `fail:${key}`
        ? text("copyFailed")
        : fallback;
  const deliver = (
    target: { machine: string } | { agent: string } | { all: true },
    on: boolean,
  ) => {
    if (owner.current()) void owner.delivery(target, on);
  };
  /** Your agent's terminal, when this computer's herdr can show it (nothing to open otherwise). */
  function goTo() {
    if (owner.current() && $runner.available)
      void owner.runner.focus(owner.roomId);
  }
  const L = (pt: string, en: string) => (lang === "en" ? en : pt);
  /** The agent that answers here (the first one listening), for its mark and color. */
  const lead = $derived(live[0] ?? mine.find((a) => a.listening) ?? null);
  const provider = $derived(agentProvider(lead?.who ?? lead?.client));
  const mark2 = $derived(AGENT_MARK_OF(provider));
  /** The row reads like yours under it: "Agent" (or "Agents"), and how it is under that. */
  const rowTitle = $derived(
    live.length > 1
      ? L("Seus agents", "Your agents")
      : L("Seu agent", "Your agent"),
  );
  const rowSub = $derived.by(() => {
    if (foot === "listening" && live.length > 1)
      return L(`${live.length} ouvindo`, `${live.length} listening`);
    if (foot === "listening") {
      const p = live[0] ? percent(live[0]) : null;
      return p === null
        ? text("footListening")
        : `${text("footListening")} · ${p}%`;
    }
    return summary;
  });
  $effect(() => {
    if (!open) more = false;
  });
  onDestroy(() => {
    active = false;
    clearTimeout(timer);
  });
</script>

{#if data}
  <div
    data-agent-foot={empty ? "setup" : "here"}
    data-agent-status={foot}
    class="flex min-w-0 items-center gap-1"
  >
    <Popover bind:open>
      <PopoverTrigger>
        {#snippet child({ props })}<button
            {...props}
            type="button"
            data-agent-summary
            class="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-lg border-0 bg-transparent min-h-12 px-2.5 py-2 text-left font-sans text-foreground hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:outline-ring"
            ><span
              aria-hidden="true"
              class={cn(
                "relative flex size-7 shrink-0 items-center justify-center rounded-lg text-sm",
                empty
                  ? "border-[1.5px] border-dashed border-muted-foreground text-muted-foreground"
                  : AGENT_TILES[provider],
              )}
              ><span
                class={foot === "working"
                  ? "inline-block animate-[spin_3s_linear_infinite] motion-reduce:animate-none"
                  : ""}>{mark2}</span
              >{#if !empty}<span
                  class={cn(
                    "absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-sidebar",
                    DOT[foot],
                  )}
                ></span>{/if}</span
            ><span class="grid min-w-0 flex-1"
              ><span class="truncate text-sm font-medium">{rowTitle}</span><span
                class={cn(
                  "truncate text-xs",
                  foot === "down" ? "text-warning" : "text-muted-foreground",
                )}>{rowSub}</span
              ></span
            >{#if !empty}<Icon
                icon="chevron-selector-vertical"
                class="size-4 shrink-0 text-muted-foreground"
              />{/if}</button
          >{/snippet}
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={8}
        class="grid w-72 max-w-[calc(100vw-16px)] gap-1 p-1.5 font-sans text-sm text-foreground"
      >
        {#if !empty}{#if machines.length > 1}<p
              class="m-0 px-2 pt-1.5 pb-0.5 text-xs font-medium text-muted-foreground"
            >
              {L("Ouvindo nesta sala", "Listening in this room")}
            </p>{/if}
          <!-- Your agents. With more than one, each is on or off in this room (any number can listen); with one, it opens its terminal. -->
          {#each machines as m (m.id)}
            {@const kids = liveOf(m)}
            <!-- One agent: its row is the machine's row. Two or more (a Claude and a Codex on one computer): the machine's row, then one line for each agent. -->
            {@const a = kids.length === 1 ? kids[0] : undefined}
            {@const tile = a ? agentProvider(a.who ?? a.client) : null}
            <div
              data-agent-machine={m.id}
              class="flex min-w-0 items-center gap-1 rounded-lg pr-2 hover:bg-accent"
            >
              <button
                type="button"
                title={text("footGoTerminal", { name: machineName(m) })}
                class={cn(
                  "flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-lg border-0 bg-transparent px-2 py-1.5 text-left font-sans text-foreground",
                  $runner.available && m.kind !== "sandbox"
                    ? "cursor-pointer"
                    : "cursor-default",
                  !m.on && "text-muted-foreground",
                )}
                onclick={() => m.kind !== "sandbox" && goTo()}
                ><span
                  class={cn(
                    "relative flex size-8 shrink-0 items-center justify-center rounded-lg text-sm",
                    tile ? AGENT_TILES[tile] : "bg-muted text-foreground",
                    !m.on && "opacity-50",
                  )}
                  >{#if tile}{AGENT_MARK_OF(tile)}{:else}<Icon
                      icon={m.kind === "sandbox" ? "cloud-01" : "app-laptop"}
                      class="size-4"
                    />{/if}<span
                    class="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-popover {m.online
                      ? 'bg-brand'
                      : 'bg-muted-foreground'}"
                  ></span></span
                ><span class="grid min-w-0 flex-1"
                  ><span class="truncate text-sm font-medium"
                    >{a
                      ? (prettyModel(a.who) || "Agent").replace(
                          /^Claude\s+/i,
                          "",
                        )
                      : machineName(m)}{a?.name ? ` · @${a.name}` : ""}</span
                  ><span class="truncate text-xs text-muted-foreground"
                    >{a
                      ? [
                          machineName(m),
                          percent(a) === null ? "" : `${percent(a)}%`,
                        ]
                          .filter(Boolean)
                          .join(" · ")
                      : kids.length > 1
                        ? L(
                            `${kids.length} ouvindo`,
                            `${kids.length} listening`,
                          )
                        : machineLine(m, 0)}</span
                  ></span
                ></button
              ><Switch
                checked={m.on}
                onCheckedChange={(on) => deliver({ machine: m.id }, on)}
                aria-label={text("footMachineSwitch", { name: machineName(m) })}
              />
            </div>
            {#if kids.length > 1}{#each kids as k (k.id ?? k.who)}
                {@const kt = agentProvider(k.who ?? k.client)}
                <div
                  data-agent-row={k.id}
                  class={cn(
                    "flex min-h-9 min-w-0 items-center gap-2.5 rounded-lg py-1 pr-2 pl-6",
                    !m.on && "text-muted-foreground",
                  )}
                >
                  <span
                    aria-hidden="true"
                    class={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-md text-xs",
                      AGENT_TILES[kt],
                      !m.on && "opacity-50",
                    )}>{AGENT_MARK_OF(kt)}</span
                  ><span class="grid min-w-0 flex-1"
                    ><span class="truncate text-sm">{who(k)}</span></span
                  >{#if percent(k) !== null}<span
                      class="shrink-0 text-xs text-muted-foreground"
                      >{percent(k)}%</span
                    >{/if}
                </div>
              {/each}{/if}
            {#if !m.online && m.on && m.kind !== "sandbox"}<button
                type="button"
                data-agent-cli-down
                title={text("offlineFix")}
                class="mx-2 mb-1 flex h-8 cursor-pointer items-center justify-between gap-2 rounded-lg border-0 bg-muted px-2.5 font-mono text-xs text-foreground hover:bg-accent"
                onclick={() => void copy("fix", "vibebook herdr")}
                >vibebook herdr<span class="font-sans text-muted-foreground"
                  >{label("fix", text("copyCmd"))}</span
                ></button
              >{/if}
          {/each}
          {#if !more}<button
              type="button"
              data-agent-more
              class="flex min-h-10 w-full cursor-pointer items-center gap-2.5 rounded-lg border-0 bg-transparent px-2 text-left font-sans text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
              onclick={() => (more = true)}
              ><span class="flex size-8 shrink-0 items-center justify-center"
                ><Icon icon="plus" class="size-4" /></span
              >{text("addAnother")}</button
            >{/if}{/if}
        {#if empty || more}<!-- Three ways in, side by side: each tile is its action. -->
          <section
            data-agent-add
            class={cn("grid grid-cols-3 gap-1.5 p-0.5", !empty && "pt-1")}
          >
            {#snippet tileBody(
              icon: "app-laptop" | "cloud-01" | "copy-01",
              name: string,
              hint: string,
            )}<Icon {icon} class="size-5" /><span
                class="text-xs leading-4 font-medium">{name}</span
              ><span class="text-[0.6875rem] leading-3 text-muted-foreground"
                >{hint}</span
              >{/snippet}
            <button
              type="button"
              data-agent-setup="computer"
              class={TILE}
              onclick={() =>
                data?.claude_on
                  ? void copy("setup", install)
                  : owner.current() && void owner.toggle()}
              >{@render tileBody(
                "app-laptop",
                L("Computador", "Computer"),
                data?.claude_on && $runner.where
                  ? text("footOpening")
                  : data?.claude_on
                    ? label("setup", L("copiar setup", "copy setup"))
                    : L("ligar aqui", "turn on"),
              )}</button
            ><a href={cloud} data-agent-setup="sandbox" class={TILE}
              >{@render tileBody(
                "cloud-01",
                L("Nuvem", "Cloud"),
                L("configurar", "set up"),
              )}</a
            ><button
              type="button"
              data-agent-setup="once"
              class={TILE}
              onclick={() =>
                void copy("prompt", connectPrompt(origin, owner.roomId))}
              >{@render tileBody(
                "copy-01",
                L("Sessão", "Session"),
                label("prompt", L("copiar prompt", "copy prompt")),
              )}</button
            >
          </section>{/if}
      </PopoverContent>
    </Popover>
    {#if empty}<Button size="xs" onclick={() => (open = true)}
        >{text("connectShort")}</Button
      >{/if}
  </div>
{/if}
