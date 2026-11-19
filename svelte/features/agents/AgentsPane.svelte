<script lang="ts">
  import { untrack } from "svelte";
  import Heading from "../../lib/ui/Heading.svelte";
  import Button from "../../lib/studio/Button.svelte";
  import AgentMark from "../../lib/components/AgentMark.svelte";
  import Checkbox from "../../lib/studio/Checkbox.svelte";
  import AgentPresenceRows from "../room-sidebar/AgentPresenceRows.svelte";
  import SetupInstructions from "./SetupInstructions.svelte";
  import { buttonVariants } from "../../lib/studio/button";
  import { settingsHref, settingsText } from "../account/settings";
  import type { RoomAgentSession } from "./room";
  import type { AgentFormatting } from "./types";
  import { agentPresence, agentQueue } from "./model";
  import { runnerPath } from "./runner";
  import { roomAgentText } from "./roomCopy";
  let {
    owner,
    origin,
    vb,
    name,
    onnavigate,
    lang = "pt",
  }: {
    owner: RoomAgentSession;
    origin: string;
    vb: AgentFormatting;
    name(email: string): string;
    onnavigate(id: number, thread: string): void;
    lang?: "pt" | "en";
  } = $props();
  const view = untrack(() => owner.state),
    runner = untrack(() => owner.runner.state);
  let shown = $state(4);
  const text = (key: Parameters<typeof roomAgentText>[1]) =>
    roomAgentText(lang, key);
  const presence = $derived(
    agentPresence($view.data, owner.account, $view.now),
  );
  const queue = $derived($view.room ? agentQueue($view.room, $view.now) : []);
  const path = $derived(runnerPath($runner.where));
  const busy = $derived(["pending", "unconfirmed"].includes($view.togglePhase));
  function navigate(id: number, thread: string) {
    if (
      owner.current() &&
      queue.some(
        (item) => item.message.id === id && item.message.thread === thread,
      )
    )
      onnavigate(id, thread);
  }
</script>

<section
  data-native-agents
  class="space-y-5 p-4 font-sans text-sm text-foreground"
>
  <div class="flex items-center gap-2">
    <Heading
      level={2}
      class="m-0 flex-1 font-sans text-lg font-semibold tracking-normal"
      >{text("title")}</Heading
    ><Button
      variant="ghost"
      size="sm"
      disabled={$view.loading}
      onclick={() => void owner.refresh(true)}>{text("retry")}</Button
    >
  </div>
  {#if $view.readError}<p role="alert" class="text-destructive">
      {text("readFailed")}
    </p>{/if}
  <div class="space-y-2 rounded-surface border border-border p-3">
    <div class="flex items-center gap-3">
      <AgentMark
        size="xs"
        mark="✻"
        class={presence.live
          ? "text-sm font-normal text-success"
          : presence.on
            ? "text-sm font-normal text-warning"
            : "text-sm font-normal text-muted-foreground"}
      />
      <div class="min-w-0 flex-1">
        <strong class="block">{text("local")}</strong><small
          class="block break-words text-muted-foreground"
          >{presence.on
            ? `${text("on")} · ${text(presence.live ? "listening" : presence.around ? "working" : "notListening")}`
            : text("off")}{#if path}
            · {path}{#if $runner.where?.how === "new"}
              ({text("newFolder")}){/if}{/if}</small
        >
      </div>
      {#if presence.on}<Button
          variant="outline"
          size="sm"
          disabled={$runner.focusing}
          onclick={() => {
            if (owner.current()) void owner.runner.focus(owner.roomId);
          }}>{text("focus")}</Button
        >{/if}
      <Checkbox
        bind:checked={() => presence.on, () => void owner.toggle()}
        disabled={busy || !$view.data}
        aria-label={text(presence.on ? "turnOff" : "turnOn")}
      />
    </div>
    <p class="m-0 text-xs text-muted-foreground">
      {text("localHelp")}
    </p>
    {#if $runner.focusError}<p role="alert" class="text-destructive">
        {text($runner.focusBlocked ? "focusBlocked" : "focusFailed")}
      </p>{/if}
    {#if $view.togglePhase === "pending"}<p role="status">
        {text("pending")}
      </p>{:else if $view.togglePhase === "error"}<p
        role="alert"
        class="text-destructive"
      >
        {text("failed")}
      </p>{:else if $view.togglePhase === "unconfirmed"}<p role="status">
        {text("unconfirmed")}
      </p>
      <Button
        variant="outline"
        onclick={() => {
          owner.reviewToggle();
          void owner.refresh(true);
        }}>{text("reviewed")}</Button
      >{/if}
  </div>
  <SetupInstructions
    {origin}
    roomId={owner.roomId}
    {lang}
    waiting={false}
    current={owner.current}
  />
  <section class="space-y-2" aria-label={text("queue")}>
    <Heading
      level={3}
      class="m-0 font-sans text-base font-semibold tracking-normal"
      >{text("queue")} {queue.length || ""}</Heading
    >
    {#each queue.slice(0, shown) as item (item.message.id)}<div
        class="flex items-center gap-2"
      >
        <Button
          variant="ghost"
          class="h-auto min-w-0 flex-1 justify-start whitespace-normal text-left"
          onclick={() => navigate(item.message.id, item.message.thread)}
          title={`${$view.room?.epics.find((epic) => epic.id === item.message.thread)?.title || text("main")} · ${vb.ago(item.message.ts)}`}
          ><span class="min-w-0 flex-1 break-words"
            >{item.message.text.replace(/\s+/g, " ").slice(0, 120)}</span
          ><span class="text-xs text-muted-foreground"
            >{text(
              item.phase === "blocked"
                ? "blocked"
                : item.phase === "doing"
                  ? "doing"
                  : "queued",
            )}</span
          ></Button
        ><Button
          variant="ghost"
          size="sm"
          disabled={["pending", "unconfirmed"].includes($view.dismissPhase)}
          onclick={() => void owner.dismiss(item.message.id)}
          aria-label={text("dismiss")}>×</Button
        >
      </div>{:else}<p class="text-muted-foreground">
        {text("queueEmpty")}
      </p>{/each}
    {#if queue.length > shown}<Button
        variant="ghost"
        size="sm"
        onclick={() => (shown += 20)}
        >{text("more")} ({queue.length - shown})</Button
      >{/if}{#if shown > 4}<Button
        variant="ghost"
        size="sm"
        onclick={() => (shown = 4)}>{text("less")}</Button
      >{/if}
    {#if $view.dismissPhase === "error"}<p
        role="alert"
        class="text-destructive"
      >
        {text("failed")}
      </p>{:else if $view.dismissPhase === "pending"}<p role="status">
        {text("pending")}
      </p>{:else if $view.dismissPhase === "unconfirmed"}<p role="status">
        {text("unconfirmed")}
      </p>
      <Button variant="outline" onclick={() => owner.reviewDismiss()}
        >{text("reviewed")}</Button
      >{/if}
  </section>
  {#if presence.mine.length}<section aria-label={text("connected")}>
      <Heading
        level={3}
        class="m-0 font-sans text-base font-semibold tracking-normal"
        >{text("connected")}</Heading
      ><AgentPresenceRows
        self
        presence={{ agents: presence.mine, sandboxes: [] }}
        email={owner.account}
        t={vb.t}
        {name}
        ago={vb.ago}
        locale={lang === "en" ? "en-US" : "pt-BR"}
        surface="background"
      />
    </section>{/if}
  <!-- Cloud agents (freestyle key, Claude token, sandboxes) live in your settings, on this room. -->
  <a
    href={settingsHref("cloud", owner.roomId)}
    data-nav
    data-native-cloud-settings
    class={buttonVariants({ variant: "outline", class: "no-underline" })}
    >☁ {settingsText(lang, "cloud")}</a
  >
</section>
