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
  import {
    agentPresence,
    agentStatus,
    connectPrompt,
    pendingAsk,
    askPreview,
  } from "./model";
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
  let step = $state(0),
    copied = $state(false);
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
  const nudge = $derived($view.hasAgent === false && !$view.setupDismissed);
  const offer = $derived(
    $view.data &&
      !nudge &&
      $view.hasAgent !== false &&
      !presence.around &&
      (!$view.offerDismissed || !!$view.askedAt),
  );
  const status = $derived(
    agentStatus(presence, $view.hasAgent, $view.askedAt, $view.now),
  );
  /** One quiet line, only while the agent can't work here: never connected, or on but not listening. Off in this
   * room has no line: the sidebar foot's delivery switch already shows it. */
  const line = $derived(
    agentsOpen
      ? null
      : nudge
        ? ({ kind: "setup", lead: "lineNone", help: "absentHelp" } as const)
        : offer && !start && status === "late"
          ? ({ kind: "offer", lead: "late", help: "lateHelp" } as const)
          : null,
  );
  $effect(() => {
    void status;
    copied = false;
  });
  async function copyPrompt() {
    if (!owner.current()) return;
    try {
      await navigator.clipboard.writeText(connectPrompt(origin, owner.roomId));
      if (owner.current()) copied = true;
    } catch {
      if (owner.current()) open();
    }
  }
  function act() {
    if (!owner.current()) return;
    if (status === "none") void copyPrompt();
    else if (status === "off") void owner.toggle();
    else open();
  }
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
  data-vb-native
  data-native-agent-banners
  class="tw:space-y-3 tw:font-sans tw:text-sm tw:text-foreground"
>
  {#if line}<div
      data-native-agent-line
      data-agent-status={status}
      role="status"
      class="tw:flex tw:items-center tw:gap-2 tw:border-b tw:border-border tw:bg-muted tw:py-2.5 tw:pr-2 tw:pl-4 tw:md:-mx-2"
    >
      <span aria-hidden="true" class="tw:shrink-0 tw:text-agent-claude-text"
        >✻</span
      >
      <p class="tw:m-0 tw:min-w-0 tw:flex-1 tw:leading-5">
        <span class="tw:font-medium">{text(line.lead)}</span
        >{#if line.help}<span class="tw:text-muted-foreground">
            {" "}{text(line.help)}</span
          >{/if}
      </p>
      <Button variant="link" size="sm" class="tw:shrink-0" onclick={act}
        >{text(
          status === "none"
            ? copied
              ? "copied"
              : "copyPrompt"
            : status === "off"
              ? "turnOn"
              : "details",
        )}</Button
      ><Button
        variant="ghost"
        size="sm"
        class="tw:shrink-0 tw:text-muted-foreground"
        aria-label={text("close")}
        onclick={() => owner.dismissBanner(line.kind)}>×</Button
      >
    </div>{/if}
  {#if $view.setupFeedback || $view.listeningFeedback}<p
      role="status"
      class="tw:mx-4 tw:my-0 tw:rounded-surface tw:border tw:border-border tw:p-3 tw:text-success"
    >
      ✻ {text($view.setupFeedback ? "setupDone" : "listeningDone")}
    </p>{/if}
  {#if start && $view.room}<div
      class="tw:mx-4 tw:flex tw:items-start tw:gap-3 tw:rounded-surface tw:border tw:border-border tw:p-3"
    >
      <span aria-hidden="true">✻</span>
      <div class="tw:min-w-0 tw:flex-1">
        <strong>{text("starting")}</strong>
        <ul class="tw:m-0 tw:list-none tw:space-y-1 tw:p-0">
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
      class="tw:mx-4 tw:flex tw:items-center tw:gap-3 tw:rounded-surface tw:border tw:border-border tw:bg-muted tw:p-3"
    >
      <p class="tw:m-0 tw:min-w-0 tw:flex-1 tw:break-words">
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
    data-vb-native
    class="tw:max-h-[90dvh] tw:overflow-auto tw:font-sans tw:text-sm tw:text-foreground"
    closeLabel={text("close")}
    preventScroll={false}
    preventBodyPointerEvents={false}
    preventOverflowTextSelection={false}
  >
    <DialogHeader class="tw:pr-8">
      <DialogTitle class="tw:font-sans"
        >{step === 0
          ? `${text("welcome")} ${$view.room?.book.title || text("main")}`
          : text(
              step === 1 ? "ownAgent" : step === 2 ? "context" : "connect",
            )}</DialogTitle
      >
    </DialogHeader>
    <p class="tw:m-0 tw:text-muted-foreground">
      {step === 0
        ? `${name($view.room?.book.owner || "")} ${text("welcomeBody")}`
        : text(
            step === 1
              ? "ownAgentBody"
              : step === 2
                ? "contextBody"
                : "connectBody",
          )}
    </p>
    {#if step === 3 && $view.hasAgent !== true}<SetupInstructions
        {origin}
        roomId={owner.roomId}
        {lang}
        current={owner.current}
      />{/if}
    <div class="tw:flex tw:items-center tw:gap-2">
      <span
        aria-label={`${step + 1} / 4`}
        class="tw:flex-1 tw:text-xs tw:text-muted-foreground"
        >{step + 1} / 4</span
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
