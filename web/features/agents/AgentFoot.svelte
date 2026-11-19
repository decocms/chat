<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import Switch from "../../lib/studio/Switch.svelte";
  import Progress from "../../lib/studio/Progress.svelte";
  import { Cloud01, type IconNode } from "../../lib/studio/icons";
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
  import { roomAgentText, type RoomAgentCopyKey } from "./roomCopy";
  import type { AgentsResult, RoomMachine } from "../../../shared/schemas";
  /**
   * Your agents at the foot of the room's sidebar (desktop). Machines (a computer running `vibebook herdr`, a sandbox
   * of yours here) each have one switch: deliver this room's messages to the agents it runs (a computer also opens
   * one when none is open). Their agents are listed under them. One-off agents (started by hand, a connector) have
   * their own switch. The group switch sets them all. With nothing yet: three ways to get an agent here.
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
  const LAPTOP: IconNode = [
    [
      "path",
      {
        d: "M20 16V7.2c0-1.12 0-1.68-.218-2.108a2 2 0 0 0-.874-.874C18.48 4 17.92 4 16.8 4H7.2c-1.12 0-1.68 0-2.108.218a2 2 0 0 0-.874.874C4 5.52 4 6.08 4 7.2V16m-1 0h18v1.333c0 .62 0 .93-.068 1.185a2 2 0 0 1-1.414 1.414C19.263 20 18.953 20 18.333 20H5.667c-.62 0-.93 0-1.185-.068a2 2 0 0 1-1.414-1.414C3 18.263 3 17.953 3 17.333V16Z",
      },
    ],
  ];
  const view = untrack(() => owner.state),
    runner = untrack(() => owner.runner.state);
  const text = (
    key: RoomAgentCopyKey,
    vars?: Record<string, string | number>,
  ) =>
    roomAgentText(lang, key).replace(/\{(\w+)\}/g, (_, k) =>
      String(vars?.[k] ?? ""),
    );
  const presence = $derived(
    agentPresence($view.data, owner.account, $view.now),
  );
  const status = $derived(
    agentStatus(presence, $view.hasAgent, $view.askedAt, $view.now),
  );
  const mark = $derived(agentMark(status, queue));
  const path = $derived(runnerPath($runner.where));
  const machines = $derived($view.data?.machines ?? []);
  const mine = $derived(
    ($view.data?.agents ?? []).filter((a) => a.email === owner.account),
  );
  const agentsOf = (m: RoomMachine) => mine.filter((a) => a.machine === m.id);
  // Every agent belongs to a machine (a computer with the CLI, or a cloud sandbox): there is no "other agents"
  // group. An agent without a machine (an MCP client without the CLI) is not listed (docs/machine-hub.md).
  /** The group reads on while any machine delivers. */
  const anyOn = $derived(machines.some((m) => m.on));
  const empty = $derived(!machines.length);
  const install = $derived(`curl -fsSL ${origin}/setup.sh | sh`);
  let copied = $state(""),
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
  // Cloud agents (freestyle key, Claude token, sandboxes) live in Settings, on this room.
  const cloud = $derived(settingsHref("cloud", owner.roomId));
  function goTo(m: RoomMachine) {
    if (!owner.current()) return;
    if (!$runner.available) onopen();
    else void owner.runner.focus(owner.roomId);
  }
  const who = (a: Agent) =>
    `${(prettyModel(a.who) || "Agent").replace(/^Claude\s+/i, "")}${a.room || a.repo ? ` · ${a.room || a.repo}` : ""}`;
  const percent = (a: Agent) =>
    a.context ? Math.round((a.context.tokens / a.context.window) * 100) : null;
  // Not listening = not connected: only when it was last seen, no delivery state or context.
  const line = (a: Agent, muted: boolean) =>
    !a.listening
      ? a.seen_at
        ? text("footSeen", { ago: ago(a.seen_at) })
        : ""
      : [
          muted ? text("footMuted") : text("footListening"),
          // Its client only when it says something (a connector by name); "started by hand" was noise.
          !a.machine && a.client && !/vibebook CLI/i.test(a.client)
            ? a.client
            : "",
          percent(a) === null ? "" : `${percent(a)}%`,
        ]
          .filter(Boolean)
          .join(" · ");
  onDestroy(() => {
    active = false;
    clearTimeout(timer);
  });
  const opt =
    "flex min-w-0 items-center justify-between gap-2 rounded-lg border border-solid border-border bg-background px-2 py-1.5";
  const btn =
    "inline-flex h-6 shrink-0 cursor-pointer items-center whitespace-nowrap rounded-full border border-solid border-border bg-background px-2 font-sans text-xs font-medium text-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring";
  const lnk =
    "cursor-pointer border-0 bg-transparent p-0 font-sans text-xs text-foreground underline underline-offset-2";
</script>

{#snippet agentRow(a: Agent, muted: boolean, own: boolean)}
  <div
    data-agent-row={a.id}
    class={cn(
      "flex min-h-8 min-w-0 items-center gap-2 rounded-lg py-1 pr-1.5",
      own ? "pl-2.5" : "pl-12",
    )}
  >
    {#if own}<span
        aria-hidden="true"
        class="flex size-7 shrink-0 items-center justify-center text-lg text-agent-claude"
        >✻</span
      >{/if}
    <span class={cn("grid min-w-0 flex-1", muted && "opacity-50")}>
      <span
        class="truncate text-sm"
        title={a.room && a.repo ? a.repo : undefined}
        >{#if a.listening && mark.state === "busy" && !muted}<span
            class="inline-block animate-[spin_3s_linear_infinite] text-agent-claude motion-reduce:animate-none"
            >✻</span
          >
        {/if}{who(a)}</span
      >
      <span class="truncate text-[0.6875rem] text-muted-foreground"
        >{line(a, muted)}</span
      >
      {#if a.listening && percent(a) !== null && !muted}<Progress
          aria-hidden="true"
          value={percent(a) ?? 0}
          class="mt-0.5 h-0.5"
        />{/if}
    </span>
    {#if own && a.listening && a.id && a.delivery !== undefined && !a.machine}<Switch
        checked={a.delivery}
        onCheckedChange={(on) => deliver({ agent: a.id! }, on)}
        aria-label={text("footAgentSwitch")}
        class="scale-90"
      />{/if}
  </div>
{/snippet}

{#if $view.data}
  {#if empty}<div data-agent-foot="setup" class="grid gap-0.5">
      <div class="flex min-h-11 items-center gap-2.5 px-2.5">
        <span
          aria-hidden="true"
          class="flex size-7 shrink-0 items-center justify-center rounded-lg border-[1.5px] border-dashed border-muted-foreground text-[0.9375rem] text-muted-foreground"
          >✻</span
        ><span class="grid min-w-0 flex-1"
          ><span class="truncate text-sm font-medium">{text("footNone")}</span
          ><span class="truncate text-xs text-muted-foreground"
            >{text("footPick")}</span
          ></span
        >
      </div>
      <div class="grid gap-1 px-2.5 pb-2 text-xs">
        <div class={opt}>
          <span class="grid min-w-0"
            ><span class="text-sm font-medium">{text("footThisComputer")}</span
            ><span class="text-muted-foreground"
              >{text("footThisComputerSub")}</span
            ></span
          >{#if $view.data.claude_on && $runner.where}<span
              data-agent-setup="opening"
              class="text-xs text-agent-claude-text animate-pulse motion-reduce:animate-none"
              >{text("footOpening")}</span
            >{:else if $view.data.claude_on}<button
              type="button"
              data-agent-setup="computer"
              class={btn}
              onclick={() => void copy("setup", install)}
              >{label("setup", text("footCopySetup"))}</button
            >{:else}<button
              type="button"
              data-agent-setup="turn-on"
              class={cn(
                btn,
                "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
              )}
              onclick={() => {
                // The old ✻ Ligar Claude (Gui #3106): every vibebook herdr, old or new, opens a Claude for a room that's
                // on. On, with no runner answering here, the setup that installs one.
                if (owner.current()) void owner.toggle();
              }}>{text("footTurnOn")}</button
            >{/if}
        </div>
        <div class={opt}>
          <span class="grid min-w-0"
            ><span class="text-sm font-medium">{text("footSandbox")}</span><span
              class="text-muted-foreground">{text("footSandboxSub")}</span
            ></span
          ><a
            href={cloud}
            data-nav
            data-agent-setup="sandbox"
            class={cn(btn, "no-underline")}>{text("footSetUp")}</a
          >
        </div>
        <div class={opt}>
          <span class="grid min-w-0"
            ><span class="text-sm font-medium">{text("footOnce")}</span><span
              class="text-muted-foreground">{text("footOnceSub")}</span
            ></span
          ><button
            type="button"
            data-agent-setup="once"
            class={btn}
            onclick={() =>
              void copy("prompt", connectPrompt(origin, owner.roomId))}
            >{label("prompt", text("footCopyPrompt"))}</button
          >
        </div>
      </div>
    </div>{:else}<div
      data-agent-foot="here"
      data-agent-status={mark.state}
      class="grid gap-0.5"
    >
      <!-- The group's title and "deliver to all" only when there is more than one machine. -->
      {#if machines.length > 1}<div
          class="flex items-center gap-1.5 px-2.5 pt-1.5 text-[0.6875rem] font-semibold tracking-wide text-muted-foreground uppercase"
        >
          <span class="flex-1">{text("footAgents")}</span>
          <span class="font-normal normal-case">{text("footDeliver")}</span>
          <Switch
            checked={anyOn}
            onCheckedChange={(on) => deliver({ all: true }, on)}
            aria-label={text("footAllSwitch")}
            class="scale-90"
          />
        </div>{/if}
      {#each machines as m (m.id)}
        {@const kids = agentsOf(m)}
        <div
          data-agent-machine={m.id}
          class="flex min-h-11 min-w-0 items-center gap-2.5 rounded-lg px-2.5"
        >
          <!-- A sandbox opens Settings › Cloud agents (its terminal is there); a computer focuses its terminal. -->
          <svelte:element
            this={m.kind === "sandbox" ? "a" : "button"}
            {...m.kind === "sandbox"
              ? { href: cloud, "data-nav": "" }
              : { type: "button", onclick: () => goTo(m) }}
            title={text("footGoTerminal", { name: m.name })}
            class="relative flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 p-0 bg-muted text-foreground hover:opacity-80"
            ><Icon
              icon={m.kind === "sandbox" ? Cloud01 : LAPTOP}
              class="size-4"
            /><span
              class="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-sidebar {m.online
                ? 'bg-brand'
                : 'bg-warning'}"
            ></span></svelte:element
          ><span class="grid min-w-0 flex-1"
            ><span class="truncate text-sm font-medium">{m.name}</span
            >{#if !m.online && m.kind !== "sandbox"}<span
                data-agent-cli-down
                class="flex min-w-0 flex-wrap items-center gap-x-1 text-xs text-warning"
                ><span
                  >{text("footOffline")}{m.seen_at
                    ? ` · ${ago(m.seen_at)}`
                    : ""} ·</span
                ><button
                  type="button"
                  title="vibebook herdr"
                  class={lnk}
                  onclick={() => void copy(`fix:${m.id}`, "vibebook herdr")}
                  >{label(`fix:${m.id}`, text("footCopyFix"))}</button
                ></span
              >{:else if !m.online}<span
                class="truncate text-xs text-muted-foreground"
                >{text("footPaused")}</span
              >{:else if m.on && m.kind !== "sandbox" && !kids.length}<span
                class="truncate text-xs text-agent-claude-text animate-pulse motion-reduce:animate-none"
                >{text("footOpening")}</span
              >{:else if m.kind !== "sandbox" && $runner.available && path}<span
                data-agent-folder
                class="truncate font-mono text-[0.6875rem] text-muted-foreground"
                >{path}</span
              >{:else}<span class="truncate text-xs text-muted-foreground"
                >{text("footOnline")}</span
              >{/if}</span
          ><Switch
            checked={m.on}
            onCheckedChange={(on) => deliver({ machine: m.id }, on)}
            aria-label={text("footMachineSwitch", { name: m.name })}
          />
        </div>
        {#each kids as a (a.id)}{@render agentRow(a, !m.on, false)}{/each}
      {/each}
      <!-- Cloud agents (freestyle sandboxes) stay one click away once you have agents (Gui #3173). -->
      <a
        href={cloud}
        data-nav
        data-agent-cloud
        class="flex min-h-8 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-left text-xs text-muted-foreground no-underline hover:bg-muted hover:text-foreground"
        ><span
          aria-hidden="true"
          class="flex size-7 shrink-0 items-center justify-center"
          ><Icon icon={Cloud01} class="size-4" /></span
        >{text("footAddCloud")}</a
      >
    </div>{/if}
{/if}
