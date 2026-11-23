<script lang="ts">
  import { onDestroy, untrack } from "svelte";
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
    `${(prettyModel(a.who) || "Agent").replace(/^Claude\s+/i, "")}${a.room || a.repo ? ` · ${a.room || a.repo}` : ""}`;
  const install = $derived(`curl -fsSL ${origin}/setup.sh | sh`);
  const cloud = $derived(settingsHref("cloud", owner.roomId));
  let open = $state(false),
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
  function goTo() {
    if (!owner.current()) return;
    if (!$runner.available) onopen();
    else void owner.runner.focus(owner.roomId);
  }
  onDestroy(() => {
    active = false;
    clearTimeout(timer);
  });
</script>

{#snippet option(
  title: RoomAgentCopyKey,
  sub: RoomAgentCopyKey,
  icon: "app-laptop" | "cloud-01" | "copy-01",
)}<span class="flex min-w-0 flex-1 items-center gap-2.5"
    ><span
      aria-hidden="true"
      class="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground"
      ><Icon {icon} class="size-3.5" /></span
    ><span class="grid min-w-0"
      ><span class="truncate text-sm font-medium">{text(title)}</span><span
        class="truncate text-xs text-muted-foreground">{text(sub)}</span
      ></span
    ></span
  >{/snippet}

{#if $view.data}
  <div
    data-agent-foot={empty ? "setup" : "here"}
    data-agent-status={foot}
    class="flex min-h-11 min-w-0 items-center gap-1 pr-2.5"
  >
    <Popover bind:open>
      <PopoverTrigger>
        {#snippet child({ props })}<button
            {...props}
            type="button"
            data-agent-summary
            class="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-lg border-0 bg-transparent py-1 pr-1 pl-2.5 text-left font-sans text-foreground hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:outline-ring"
            ><span
              aria-hidden="true"
              class={cn(
                "relative flex size-7 shrink-0 items-center justify-center rounded-lg text-[0.9375rem]",
                empty
                  ? "border-[1.5px] border-dashed border-muted-foreground text-muted-foreground"
                  : "bg-muted text-agent-claude",
              )}
              ><span
                class={foot === "working"
                  ? "inline-block animate-[spin_3s_linear_infinite] motion-reduce:animate-none"
                  : ""}>✻</span
              >{#if !empty}<span
                  class={cn(
                    "absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-sidebar",
                    DOT[foot],
                  )}
                ></span>{/if}</span
            ><span class="grid min-w-0 flex-1"
              ><span class="truncate text-sm font-medium"
                >{text("yourClaude")}</span
              ><span
                class={cn(
                  "truncate text-xs",
                  foot === "down" ? "text-warning" : "text-muted-foreground",
                )}>{summary}</span
              ></span
            ></button
          >{/snippet}
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={8}
        class="grid w-80 gap-3 p-3 font-sans text-sm text-foreground"
      >
        {#if !empty}<!-- Your machines here and the Claudes listening on them. -->
          <div data-agent-machines class="grid gap-1">
            {#each machines as m (m.id)}
              {@const kids = liveOf(m)}
              <div
                data-agent-machine={m.id}
                class="flex min-h-9 min-w-0 items-center gap-2.5"
              >
                <button
                  type="button"
                  title={text("footGoTerminal", { name: machineName(m) })}
                  class="relative flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-muted p-0 text-foreground hover:opacity-80"
                  onclick={() => (m.kind === "sandbox" ? null : goTo())}
                  ><Icon
                    icon={m.kind === "sandbox" ? "cloud-01" : "app-laptop"}
                    class="size-3.5"
                  /><span
                    class="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-popover {m.online
                      ? 'bg-brand'
                      : 'bg-muted-foreground'}"
                  ></span></button
                ><span class="grid min-w-0 flex-1"
                  ><span class="truncate text-sm font-medium"
                    >{machineName(m)}</span
                  ><span class="truncate text-xs text-muted-foreground"
                    >{machineLine(m, kids.length)}</span
                  ></span
                >{#if machines.length > 1}<Switch
                    checked={m.on}
                    onCheckedChange={(on) => deliver({ machine: m.id }, on)}
                    aria-label={text("footMachineSwitch", {
                      name: machineName(m),
                    })}
                  />{/if}
              </div>
              {#each kids as a (a.id)}<div
                  data-agent-row={a.id}
                  class="flex min-w-0 items-center gap-2 pl-9.5 text-xs"
                >
                  <span class="min-w-0 flex-1 truncate">{who(a)}</span>
                  {#if percent(a) !== null}<span
                      class="shrink-0 text-muted-foreground tabular-nums"
                      >{percent(a)}%</span
                    >{/if}
                </div>{/each}
            {/each}
          </div>
          {#if foot === "down"}<div
              data-agent-cli-down
              class="grid gap-1.5 text-xs text-muted-foreground"
            >
              <span>{text("hereFix")}</span>
              <button
                type="button"
                class="flex h-8 w-full cursor-pointer items-center justify-between gap-2 rounded-lg border-0 bg-muted px-2.5 font-mono text-xs text-foreground hover:bg-accent"
                onclick={() => void copy("fix", "vibebook herdr")}
                >vibebook herdr<span class="font-sans text-muted-foreground"
                  >{label("fix", text("copyCmd"))}</span
                ></button
              >
            </div>{/if}
          <hr class="m-0 border-0 border-t border-border" />{/if}
        <!-- The ways to add an agent: this computer, the cloud, or one Claude Code just this once. -->
        <div data-agent-add class="grid gap-2">
          <span class="text-xs font-medium text-muted-foreground"
            >{text(empty ? "footPick" : "addAgent")}</span
          >
          <div class="flex items-center gap-2" data-agent-setup="computer">
            {@render option(
              "footThisComputer",
              "footThisComputerSub",
              "app-laptop",
            )}{#if $view.data.claude_on && $runner.where}<span
                class="shrink-0 text-xs text-agent-claude-text"
                >{text("footOpening")}</span
              >{:else if $view.data.claude_on}<Button
                size="xs"
                variant="outline"
                onclick={() => void copy("setup", install)}
                >{label("setup", text("footCopySetup"))}</Button
              >{:else}<Button
                size="xs"
                onclick={() => {
                  if (owner.current()) void owner.toggle();
                }}>{text("footTurnOn")}</Button
              >{/if}
          </div>
          <div class="flex items-center gap-2" data-agent-setup="sandbox">
            {@render option("footSandbox", "footSandboxSub", "cloud-01")}<Button
              size="xs"
              variant="outline"
              href={cloud}>{text("footSetUp")}</Button
            >
          </div>
          <div class="flex items-center gap-2" data-agent-setup="once">
            {@render option("footOnce", "footOnceSub", "copy-01")}<Button
              size="xs"
              variant="outline"
              onclick={() =>
                void copy("prompt", connectPrompt(origin, owner.roomId))}
              >{label("prompt", text("footCopyPrompt"))}</Button
            >
          </div>
        </div>
      </PopoverContent>
    </Popover>
    {#if empty}<Button size="xs" onclick={() => (open = true)}
        >{text("connectShort")}</Button
      >{:else}<Switch
        checked={anyOn}
        onCheckedChange={(on) => deliver({ all: true }, on)}
        aria-label={text("respondSwitch")}
      />{/if}
  </div>
{/if}
