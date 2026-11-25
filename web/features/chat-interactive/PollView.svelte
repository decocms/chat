<script lang="ts">
  import PersonAvatar from "../../lib/components/PersonAvatar.svelte";
  import { onDestroy, untrack } from "svelte";
  import type { Room, Message, Poll } from "../../../shared/room";
  import type { ChatActions, ChatBridge } from "../../app/chatTypes";
  import { pollView, canClosePoll, pollIdentity } from "./model";
  import { createInteractiveSession, idleState } from "./session";
  import Button from "../../lib/studio/Button.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import ConfirmDialog from "../../lib/components/ConfirmDialog.svelte";
  let {
    poll,
    message,
    room,
    actions,
    vb,
  }: {
    poll: Poll;
    message: Message;
    room: Room;
    actions: ChatActions;
    vb: ChatBridge;
  } = $props();
  let active = true,
    status = $state(idleState()),
    closing = $state(false),
    focusTarget = $state<HTMLElement | null>(null),
    selectedIdentity = $state<string | undefined>();
  const identity = $derived(
    JSON.stringify([
      message.id,
      message.thread,
      message.poll,
      pollIdentity(poll),
    ]),
  );
  const session = untrack(() =>
    createInteractiveSession(
      room.id,
      message.id,
      (next) => (status = next),
      undefined,
      "poll",
    ),
  );
  const view = $derived(pollView(poll, room.me));
  const canClose = $derived(canClosePoll(room, poll));
  const canVote = $derived(!poll.closed && room.members.includes(room.me));
  const votes = $derived(view.rows.reduce((sum, row) => sum + row.count, 0));
  const waiting = $derived(
    status.phase === "pending" || status.phase === "unconfirmed",
  );
  $effect(() => {
    const snapshot = room;
    untrack(() => session.sync(snapshot));
  });
  $effect(() => {
    if (
      !canClose ||
      status.phase === "unconfirmed" ||
      (selectedIdentity !== undefined && selectedIdentity !== identity)
    )
      closing = false;
  });
  onDestroy(() => {
    active = false;
    session.dispose();
  });
  function vote(index: number, event: MouseEvent) {
    if (
      active &&
      event.currentTarget instanceof HTMLElement &&
      event.currentTarget.isConnected &&
      canVote
    )
      void session.vote(index, actions.request);
  }
  function close() {
    if (active && canClose && closing && selectedIdentity === identity)
      void session.close(actions.request);
  }
</script>

<section
  data-poll={poll.id}
  class="grid max-w-md gap-3 rounded-surface bg-card p-4 font-sans text-sm text-card-foreground shadow-edge"
>
  <header class="flex items-baseline justify-between gap-3">
    <h4
      class="m-0 min-w-0 break-words font-sans text-sm font-medium tracking-normal [font-variation-settings:normal]"
    >
      {poll.question}
    </h4>
    <span
      data-poll-votes
      class="shrink-0 text-xs tabular-nums text-muted-foreground"
      >{votes === 1 ? vb.t("1 voto") : vb.t("{n} votos", { n: votes })}</span
    >
  </header>
  <div class="grid gap-1.5">
    {#each view.rows as row}<button
        type="button"
        data-vote={row.index}
        aria-pressed={row.mine}
        aria-label={`${row.label}: ${row.count === 1 ? vb.t("1 voto") : vb.t("{n} votos", { n: row.count })} (${row.percent}%)`}
        disabled={!canVote || waiting}
        onclick={(event) => vote(row.index, event)}
        class="group/vote relative flex min-h-9 w-full items-center gap-2 overflow-hidden rounded-lg border border-solid px-3 py-2 text-left font-sans text-sm transition-colors enabled:cursor-pointer disabled:cursor-default {row.mine
          ? 'border-brand-purple/60 bg-brand-purple/15 enabled:hover:bg-brand-purple/25'
          : 'border-transparent bg-muted enabled:hover:bg-secondary-hover'}"
        ><!-- The fill is a native progress value, since inline styles are not allowed here. --><progress
          aria-hidden="true"
          data-vote-bar
          value={row.percent}
          max="100"
          class="pointer-events-none absolute inset-0 block h-full w-full appearance-none border-0 bg-transparent [&::-moz-progress-bar]:bg-current [&::-webkit-progress-bar]:bg-transparent [&::-webkit-progress-value]:bg-current {row.mine
            ? 'text-brand-purple/25'
            : 'text-input'}"
        ></progress>{#if row.winner}<Icon
            icon="trophy-01"
            size={16}
            class="relative shrink-0 {row.mine ? 'text-brand-purple-text' : ''}"
          />{:else if row.mine}<Icon
            icon="check"
            size={16}
            class="relative shrink-0 text-brand-purple-text"
          />{/if}<span
          class="relative min-w-0 flex-1 break-words {row.mine
            ? 'font-medium'
            : ''}">{row.label}</span
        >{#if row.voters.length}<span
            class="relative flex -space-x-1.5 opacity-0 transition-opacity group-hover/vote:opacity-100 group-focus-visible/vote:opacity-100"
            >{#each row.voters as email}<span title={vb.name(email)}
                ><PersonAvatar
                  data-avatar="person"
                  size="xs"
                  {email}
                  version={vb.avatarVersion(email)}
                  class="ring-2 ring-card"
                /></span
              >{/each}</span
          >{/if}<span
          class="relative shrink-0 text-xs tabular-nums {row.mine
            ? 'font-semibold text-brand-purple-text'
            : 'text-muted-foreground'}">{row.percent}%</span
        ></button
      >{/each}
  </div>
  {#if poll.closed}<p class="m-0 text-xs text-muted-foreground">
      {vb.t("Votação encerrada")}
    </p>{:else if canClose}<Button
      size="xs"
      variant="ghost"
      class="-ml-2 justify-self-start text-muted-foreground"
      data-poll-close
      disabled={waiting}
      onclick={(event) => {
        if (active && canClose && event.currentTarget.isConnected) {
          focusTarget = event.currentTarget;
          selectedIdentity = identity;
          closing = true;
        }
      }}>{vb.t("Encerrar votação")}</Button
    >{/if}
  {#if status.phase !== "idle"}<p
      role={status.phase === "error" ? "alert" : "status"}
      class="m-0 text-xs text-muted-foreground"
    >
      {status.phase === "pending"
        ? vb.t("Enviando…")
        : status.phase === "unconfirmed"
          ? vb.t(
              "Ainda sem confirmação. Confira a sala antes de enviar novamente.",
            )
          : status.error}
    </p>{/if}
</section>
<ConfirmDialog
  open={closing && canClose && selectedIdentity === identity}
  title={vb.t("Encerrar a votação?")}
  confirmLabel={vb.t("Confirmar")}
  cancelLabel={vb.t("Cancelar")}
  busy={status.phase === "pending"}
  error={status.phase === "error" ? status.error : ""}
  onconfirm={close}
  onOpenChange={(open) => {
    if (!open) closing = false;
  }}
  returnFocus={() => focusTarget}
/>
