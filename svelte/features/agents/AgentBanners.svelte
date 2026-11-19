<script lang="ts">
  import { untrack } from "svelte";
  import Button from "../../lib/studio/Button.svelte";
  import Dialog from "../../lib/studio/Dialog.svelte";
  import DialogContent from "../../lib/studio/DialogContent.svelte";
  import DialogHeader from "../../lib/studio/DialogHeader.svelte";
  import DialogTitle from "../../lib/studio/DialogTitle.svelte";
  import { registerDialog } from "../../lib/studio/dialogController";
  import SetupInstructions from "./SetupInstructions.svelte";
  import type { RoomAgentSession } from "./room";
  import { agentPresence, agentStatus, pendingAsk, askPreview } from "./model";
  import { roomAgentText } from "./roomCopy";
  let {
    owner,
    origin,
    name,
    onopen,
    onnavigate,
    agentsOpen = false,
    lang = "pt",
  }: {
    owner: RoomAgentSession;
    origin: string;
    name(email: string): string;
    onopen(): void;
    onnavigate(id: number, thread: string): void;
    /** The Agents pane is on screen: it says what the line would, with more room. */
    agentsOpen?: boolean;
    lang?: "pt" | "en";
  } = $props();
  const view = untrack(() => owner.state);
  const text = (key: Parameters<typeof roomAgentText>[1]) =>
    roomAgentText(lang, key);
  // The welcome names the room only when it adds something: a room titled with the owner's name would read "Gimenes invited you to Gimenes".
  const inviter = $derived(name($view.room?.book.owner || ""));
  const welcomeRoom = $derived.by(() => {
    const title = $view.room?.book.title?.trim() || "";
    return title && title.toLowerCase() !== inviter.trim().toLowerCase()
      ? title
      : "";
  });
  let step = $state(0);
  const presence = $derived(
    agentPresence($view.data, owner.account, $view.now),
  );
  const ask = $derived(pendingAsk($view.waits, owner.roomId, $view.thread));
  const start = $derived(
    $view.room?.book.owner === owner.account &&
      !$view.room.book.dm &&
      !$view.room.epics.length &&
      $view.thread === "main" &&
      !$view.startDismissed,
  );
  const offer = $derived(
    $view.data &&
      $view.hasAgent !== false &&
      !presence.around &&
      (!$view.offerDismissed || !!$view.askedAt),
  );
  const status = $derived(
    agentStatus(presence, $view.hasAgent, $view.askedAt, $view.now),
  );
  /** One quiet line, only while the agent is on but not listening. Off in this room has no line: the sidebar
   * foot's delivery switch already shows it. */
  const line = $derived(
    !agentsOpen && offer && !start && status === "late"
      ? ({ kind: "offer", lead: "late", help: "lateHelp" } as const)
      : null,
  );
  $effect(() => {
    if ($view.welcome && owner.current())
      return registerDialog(() => owner.closeWelcome());
  });
  function open() {
    if (owner.current()) onopen();
  }
  function navigate() {
    const current = pendingAsk($view.waits, owner.roomId, $view.thread);
    if (owner.current() && current && /^a\d+$/.test(current.ref)) {
      const id = Number(current.ref.slice(1));
      if (Number.isSafeInteger(id)) onnavigate(id, current.thread || "main");
    }
  }
</script>

<div
  data-native-agent-banners
  class="space-y-3 font-sans text-sm text-foreground"
>
  {#if line}<div
      data-native-agent-line
      data-agent-status={status}
      role="status"
      class="flex items-center gap-2 border-b border-border bg-muted py-2.5 pr-2 pl-4 md:-mx-2"
    >
      <span aria-hidden="true" class="shrink-0 text-agent-claude-text">✻</span>
      <p class="m-0 min-w-0 flex-1 leading-5">
        <span class="font-medium">{text(line.lead)}</span>{#if line.help}<span
            class="text-muted-foreground"
          >
            {" "}{text(line.help)}</span
          >{/if}
      </p>
      <Button variant="link" size="sm" class="shrink-0" onclick={open}
        >{text("details")}</Button
      ><Button
        variant="ghost"
        size="sm"
        class="shrink-0 text-muted-foreground"
        aria-label={text("close")}
        onclick={() => owner.dismissBanner(line.kind)}>×</Button
      >
    </div>{/if}
  {#if $view.setupFeedback || $view.listeningFeedback}<p
      role="status"
      class="mx-4 my-0 rounded-surface border border-border p-3 text-success"
    >
      ✻ {text($view.setupFeedback ? "setupDone" : "listeningDone")}
    </p>{/if}
  {#if start && $view.room}<div
      class="mx-4 flex items-start gap-3 rounded-surface border border-border p-3"
    >
      <span aria-hidden="true">✻</span>
      <div class="min-w-0 flex-1">
        <strong>{text("starting")}</strong>
        <ul class="m-0 list-none space-y-1 p-0">
          <li>✓ {text("roomCreated")}</li>
          <li>
            {$view.room.members.length > 1
              ? `✓ ${text("members")}: ${$view.room.members
                  .filter((member) => member !== owner.account)
                  .map(name)
                  .join(", ")}`
              : `○ ${text("alone")}`}
          </li>
          <li>
            {presence.around
              ? `✓ ${text("here")}`
              : $view.hasAgent === false
                ? `○ ${text("connectFirst")}`
                : presence.on
                  ? `✻ ${text("opening")}`
                  : `○ ${text("agentOff")}`}{#if $view.hasAgent !== false && !presence.on}<Button
                variant="link"
                size="sm"
                onclick={open}>{text("turnOn")}</Button
              >{/if}
          </li>
          <li>{presence.around ? "✻" : "○"} {text("docNext")}</li>
        </ul>
      </div>
      <Button
        variant="ghost"
        size="sm"
        aria-label={text("close")}
        onclick={() => owner.dismissBanner("start")}>×</Button
      >
    </div>
  {/if}
  {#if ask}<div
      class="mx-4 flex items-center gap-3 rounded-surface border border-border bg-muted p-3"
    >
      <p class="m-0 min-w-0 flex-1 break-words">
        ⏸ <strong>{text("ask")}</strong> · {ask.topic || text("main")}: {askPreview(
          ask.text,
        )}
      </p>
      <Button size="sm" onclick={navigate}>{text("view")}</Button>
    </div>{/if}
</div>
<Dialog
  open={$view.welcome && owner.current()}
  onOpenChange={(open) => {
    if (!open) owner.closeWelcome();
  }}
>
  <DialogContent
    class="max-h-[90dvh] overflow-auto font-sans text-sm text-foreground"
    closeLabel={text("close")}
    preventScroll={false}
    preventBodyPointerEvents={false}
    preventOverflowTextSelection={false}
  >
    <DialogHeader class="pr-8">
      {#if step === 0}<img
          src="/favicon.svg"
          width="40"
          height="40"
          alt=""
          draggable="false"
          class="size-10 rounded-xl"
        />{/if}
      <DialogTitle class="font-sans"
        >{step === 0
          ? text("welcome")
          : text(
              step === 1 ? "ownAgent" : step === 2 ? "context" : "connect",
            )}</DialogTitle
      >
    </DialogHeader>
    <p class="m-0 text-muted-foreground">
      {#if step === 0}{inviter}
        {#if welcomeRoom}{text("welcomeTo")}
          <b class="text-foreground">{welcomeRoom}</b>.{:else}{text(
            "welcomeHere",
          )}{/if}
        {text("welcomeBody")}{:else}{text(
          step === 1
            ? "ownAgentBody"
            : step === 2
              ? "contextBody"
              : "connectBody",
        )}{/if}
    </p>
    {#if step === 3 && $view.hasAgent !== true}<SetupInstructions
        {origin}
        roomId={owner.roomId}
        {lang}
        current={owner.current}
      />{/if}
    <div class="flex items-center gap-2">
      <span
        aria-label={`${step + 1} / 4`}
        class="flex-1 text-xs text-muted-foreground">{step + 1} / 4</span
      ><Button
        variant="ghost"
        onclick={() => {
          if (step) step--;
          else owner.closeWelcome();
        }}>{text(step ? "back" : "skip")}</Button
      ><Button
        onclick={() => {
          if (step === 3) owner.closeWelcome();
          else step++;
        }}>{text(step === 3 ? "enter" : "next")}</Button
      >
    </div>
  </DialogContent>
</Dialog>
