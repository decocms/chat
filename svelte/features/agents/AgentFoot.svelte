<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import Switch from "../../lib/studio/Switch.svelte";
  import Progress from "../../lib/studio/Progress.svelte";
  import { Cloud01, type IconNode } from "../../lib/studio/icons";
  import { cn } from "../../lib/studio/utils";
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
  const others = $derived(
    mine.filter((a) => !a.machine || !machines.some((m) => m.id === a.machine)),
  );
  /** Anything that can take a switch: the group reads on while any of them delivers. */
  const anyOn = $derived(
    machines.some((m) => m.on) || others.some((a) => a.delivery !== false),
  );
  const empty = $derived(!machines.length && !mine.length);
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
  function goTo(m: RoomMachine) {
    if (!owner.current()) return;
    if (m.kind === "sandbox" || !$runner.available) onopen();
    else void owner.runner.focus(owner.roomId);
  }
  const who = (a: Agent) =>
    `${(prettyModel(a.who) || "Agent").replace(/^Claude\s+/i, "")}${a.repo ? ` · ${a.repo}` : ""}`;
  const percent = (a: Agent) =>
    a.context ? Math.round((a.context.tokens / a.context.window) * 100) : null;
  const line = (a: Agent, muted: boolean) =>
    [
      muted
        ? text("footMuted")
        : a.listening
          ? text("footListening")
          : a.seen_at
            ? text("footSeen", { ago: ago(a.seen_at) })
            : "",
      !a.machine && a.client && !/vibebook CLI/i.test(a.client)
        ? a.client
        : !a.machine
          ? text("footByHand")
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
    "tw:flex tw:min-w-0 tw:items-center tw:justify-between tw:gap-2 tw:rounded-lg tw:border tw:border-solid tw:border-border tw:bg-background tw:px-2 tw:py-1.5";
  const btn =
    "tw:inline-flex tw:h-6 tw:shrink-0 tw:cursor-pointer tw:items-center tw:whitespace-nowrap tw:rounded-full tw:border tw:border-solid tw:border-border tw:bg-background tw:px-2 tw:font-sans tw:text-xs tw:font-medium tw:text-foreground tw:hover:bg-accent tw:focus-visible:outline-2 tw:focus-visible:outline-ring";
  const lnk =
    "tw:cursor-pointer tw:border-0 tw:bg-transparent tw:p-0 tw:font-sans tw:text-xs tw:text-foreground tw:underline tw:underline-offset-2";
</script>

{#snippet agentRow(a: Agent, muted: boolean, own: boolean)}
  <div
    data-agent-row={a.id}
    class={cn(
      "tw:flex tw:min-h-8 tw:min-w-0 tw:items-center tw:gap-2 tw:rounded-lg tw:py-1 tw:pr-1.5",
      own ? "tw:pl-2.5" : "tw:pl-12",
    )}
  >
    {#if own}<span
        aria-hidden="true"
        class="tw:flex tw:size-7 tw:shrink-0 tw:items-center tw:justify-center tw:text-lg tw:text-agent-claude"
        >✻</span
      >{/if}
    <span class={cn("tw:grid tw:min-w-0 tw:flex-1", muted && "tw:opacity-50")}>
      <span class="tw:truncate tw:text-[0.8125rem]"
        >{#if a.listening && mark.state === "busy" && !muted}<span
            class="tw:inline-block tw:animate-[spin_3s_linear_infinite] tw:text-agent-claude tw:motion-reduce:animate-none"
            >✻</span
          >
        {/if}{who(a)}</span
      >
      <span class="tw:truncate tw:text-[0.6875rem] tw:text-muted-foreground"
        >{line(a, muted)}</span
      >
      {#if percent(a) !== null && !muted}<Progress
          aria-hidden="true"
          value={percent(a) ?? 0}
          class="tw:mt-0.5 tw:h-0.5"
        />{/if}
    </span>
    {#if own && a.id && a.delivery !== undefined && !a.machine}<Switch
        checked={a.delivery}
        onCheckedChange={(on) => deliver({ agent: a.id! }, on)}
        aria-label={text("footAgentSwitch")}
        class="tw:scale-90"
      />{/if}
  </div>
{/snippet}

{#if $view.data}
  {#if empty}<div data-native-agent-foot="setup" class="tw:grid tw:gap-0.5">
      <div class="tw:flex tw:min-h-11 tw:items-center tw:gap-2.5 tw:px-2.5">
        <span
          aria-hidden="true"
          class="tw:flex tw:size-7 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-lg tw:border-[1.5px] tw:border-dashed tw:border-muted-foreground tw:text-[0.9375rem] tw:text-muted-foreground"
          >✻</span
        ><span class="tw:grid tw:min-w-0 tw:flex-1"
          ><span class="tw:truncate tw:text-sm tw:font-medium"
            >{text("footNone")}</span
          ><span class="tw:truncate tw:text-xs tw:text-muted-foreground"
            >{text("footPick")}</span
          ></span
        >
      </div>
      <div class="tw:grid tw:gap-1 tw:px-2.5 tw:pb-2 tw:text-xs">
        <div class={opt}>
          <span class="tw:grid tw:min-w-0"
            ><span class="tw:text-[0.8125rem] tw:font-medium"
              >{text("footThisComputer")}</span
            ><span class="tw:text-muted-foreground"
              >{text("footThisComputerSub")}</span
            ></span
          ><button
            type="button"
            data-agent-setup="computer"
            class={cn(
              btn,
              "tw:border-primary tw:bg-primary tw:text-primary-foreground tw:hover:bg-primary/90",
            )}
            onclick={() => void copy("setup", install)}
            >{label("setup", text("footCopySetup"))}</button
          >
        </div>
        <div class={opt}>
          <span class="tw:grid tw:min-w-0"
            ><span class="tw:text-[0.8125rem] tw:font-medium"
              >{text("footSandbox")}</span
            ><span class="tw:text-muted-foreground"
              >{text("footSandboxSub")}</span
            ></span
          ><button
            type="button"
            data-agent-setup="sandbox"
            class={btn}
            onclick={() => {
              if (owner.current()) onopen();
            }}>{text("footSetUp")}</button
          >
        </div>
        <div class={opt}>
          <span class="tw:grid tw:min-w-0"
            ><span class="tw:text-[0.8125rem] tw:font-medium"
              >{text("footOnce")}</span
            ><span class="tw:text-muted-foreground">{text("footOnceSub")}</span
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
      data-native-agent-foot="here"
      data-agent-status={mark.state}
      class="tw:grid tw:gap-0.5"
    >
      <div
        class="tw:flex tw:items-center tw:gap-1.5 tw:px-2.5 tw:pt-1.5 tw:text-[0.6875rem] tw:font-semibold tw:tracking-wide tw:text-muted-foreground tw:uppercase"
      >
        <span class="tw:flex-1"
          >{text(machines.length ? "footAgents" : "footOthers")}</span
        >
        <span class="tw:font-normal tw:normal-case">{text("footDeliver")}</span>
        <Switch
          checked={anyOn}
          onCheckedChange={(on) => deliver({ all: true }, on)}
          aria-label={text("footAllSwitch")}
          class="tw:scale-90"
        />
      </div>
      {#each machines as m (m.id)}
        {@const kids = agentsOf(m)}
        <div
          data-agent-machine={m.id}
          class="tw:flex tw:min-h-11 tw:min-w-0 tw:items-center tw:gap-2.5 tw:rounded-lg tw:px-2.5"
        >
          <button
            type="button"
            title={text("footGoTerminal", { name: m.name })}
            class="tw:relative tw:flex tw:size-7 tw:shrink-0 tw:cursor-pointer tw:items-center tw:justify-center tw:rounded-lg tw:border-0 tw:p-0 tw:bg-muted tw:text-foreground tw:hover:opacity-80"
            onclick={() => goTo(m)}
            ><Icon
              icon={m.kind === "sandbox" ? Cloud01 : LAPTOP}
              class="tw:size-4"
            /><span
              class="tw:absolute tw:-right-0.5 tw:-bottom-0.5 tw:size-2.5 tw:rounded-full tw:ring-2 tw:ring-sidebar {m.online
                ? 'tw:bg-brand'
                : 'tw:bg-warning'}"
            ></span></button
          ><span class="tw:grid tw:min-w-0 tw:flex-1"
            ><span class="tw:truncate tw:text-sm tw:font-medium">{m.name}</span
            >{#if !m.online && m.kind !== "sandbox"}<span
                data-agent-cli-down
                class="tw:flex tw:min-w-0 tw:flex-wrap tw:items-center tw:gap-x-1 tw:text-xs tw:text-warning"
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
                class="tw:truncate tw:text-xs tw:text-muted-foreground"
                >{text("footPaused")}</span
              >{:else if m.on && m.kind !== "sandbox" && !kids.length}<span
                class="tw:truncate tw:text-xs tw:text-agent-claude-text tw:animate-pulse tw:motion-reduce:animate-none"
                >{text("footOpening")}</span
              >{:else if m.kind !== "sandbox" && $runner.available && path}<span
                data-agent-folder
                class="tw:truncate tw:font-mono tw:text-[0.6875rem] tw:text-muted-foreground"
                >{path}</span
              >{:else}<span
                class="tw:truncate tw:text-xs tw:text-muted-foreground"
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
      {#if others.length && machines.length}<div
          class="tw:px-2.5 tw:pt-1.5 tw:text-[0.6875rem] tw:font-semibold tw:tracking-wide tw:text-muted-foreground tw:uppercase"
        >
          {text("footOthers")}
        </div>{/if}
      {#each others as a (a.id ?? a.who)}{@render agentRow(
          a,
          a.delivery === false,
          true,
        )}{/each}
      {#if !machines.length}<p
          class="tw:m-0 tw:px-2.5 tw:pb-1.5 tw:pl-12 tw:text-[0.6875rem] tw:text-muted-foreground"
        >
          {text("footConnectHere")}
          <button
            type="button"
            class={lnk}
            onclick={() => void copy("setup", install)}
            >{label("setup", text("footConnectHereLink"))}</button
          >
        </p>{/if}
    </div>{/if}
{/if}
